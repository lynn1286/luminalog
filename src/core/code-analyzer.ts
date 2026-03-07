import * as vscode from "vscode";
import { REGEX } from "../constants/regex";
import { ICodeAnalyzer, JSBlockType } from "../types/services";
import { InsertionAnalysisEngine } from "./insertion-engine";

/**
 * 代码分析器
 *
 * 负责分析代码结构，确定 console.log 的插入位置和缩进
 * 使用基于 AST 的分析来准确处理各种复杂情况
 *
 * 参考 turbo-console-log 的实现思路，但使用我们自己的架构和命名
 */
export class CodeAnalyzer implements ICodeAnalyzer {
  private engine: InsertionAnalysisEngine;

  constructor() {
    this.engine = new InsertionAnalysisEngine();
  }

  public isClassDeclaration(line: string): boolean {
    return REGEX.CLASS_DECLARATION.test(line);
  }

  public isObjectDeclaration(line: string): boolean {
    return REGEX.OBJECT_DECLARATION.test(line);
  }

  public isFunctionDeclaration(line: string): boolean {
    // 首先排除 JavaScript 内置控制语句
    if (this.isBuiltInStatement(line)) {
      return false;
    }

    // 排除接口/类型定义中的函数类型属性
    // 例如：onClose: () => void;
    // 特征：以分号结尾，且没有函数体（没有 { }）
    if (/:\s*\(.*\)\s*=>\s*[^{;]*;/.test(line)) {
      return false;
    }

    // Check if line contains function keyword (for multi-line declarations)
    const hasFunctionKeyword = /\bfunction\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/.test(line);

    // Check if line is an arrow function or method declaration
    // 支持带类型注解的箭头函数：const name: Type = (...) => 或 const name = (...) =>
    const isArrowOrMethod =
      /[a-zA-Z_$][a-zA-Z0-9_$]*\s*[=:]\s*(async\s+)?\(.*\)\s*(=>|:)/.test(line) ||
      /[a-zA-Z_$][a-zA-Z0-9_$]*\s*:\s*[^=]+\s*=\s*(async\s+)?\(.*\)\s*=>/.test(line);

    // Check if line is a multi-line arrow function assignment (arrow on next line)
    // Pattern: const name = ( or const name = async (
    // Must be directly after =, not a function call like throttle(...)
    const isMultiLineArrow = /(const|let|var)\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*(async\s+)?\(/.test(
      line
    );

    // Check if line is a function expression: const name = function() {}
    // Must have 'function' keyword after =
    const isFunctionExpression =
      /(const|let|var)\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*function\s*\(/.test(line);

    // Original regex check (for single-line declarations with opening brace)
    const isNamed = REGEX.NAMED_FUNCTION.test(line);
    const isNonNamed = REGEX.NON_NAMED_FUNCTION.test(line);

    return (
      (isNamed && !isNonNamed) ||
      isFunctionExpression ||
      hasFunctionKeyword ||
      isArrowOrMethod ||
      isMultiLineArrow
    );
  }

  public isBuiltInStatement(line: string): boolean {
    return REGEX.JS_BUILT_IN.test(line);
  }

  public extractClassName(line: string): string {
    if (line.split(/class /).length >= 2) {
      const textAfterClass = line.split(/class /)[1].trim();

      // 提取类名：只取第一个单词，忽略 extends、implements、泛型等
      // 匹配模式：标识符（可能带泛型）
      const classNameMatch = textAfterClass.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/);

      if (classNameMatch) {
        return classNameMatch[1];
      }

      // 回退：使用原来的逻辑
      const className = textAfterClass.split(" ")[0].replace("{", "");
      return className || textAfterClass.replace("{", "");
    }
    return "";
  }

  public extractFunctionName(line: string): string {
    // Handle: export async function name(...) or export function name(...)
    const exportFunctionMatch = line.match(
      /export\s+(async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/
    );
    if (exportFunctionMatch) {
      return exportFunctionMatch[2];
    }

    // Handle: function name() {}
    if (/function(\s+)[a-zA-Z]+(\s*)\(.*\)(\s*){/.test(line)) {
      if (line.split("function ").length > 1) {
        return line.split("function ")[1].split("(")[0].replace(/(\s*)/g, "");
      }
    }

    // Handle: async function name(...) without export
    const asyncFunctionMatch = line.match(/async\s+function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/);
    if (asyncFunctionMatch) {
      return asyncFunctionMatch[1];
    }

    // Handle: function name(...) - multi-line case
    const functionMatch = line.match(/function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/);
    if (functionMatch) {
      return functionMatch[1];
    }

    // Handle: const name = () => {} or name() {}
    if (line.split(/\(.*\)/).length > 0) {
      const leftPart = line.split(/\(.*\)/)[0];

      // Has assignment
      if (/=/.test(leftPart)) {
        if (leftPart.split("=").length > 0) {
          const beforeEquals = leftPart.split("=")[0];
          // Remove keywords and extract name, also handle TypeScript type annotations
          let name = beforeEquals.replace(/export |module.exports |const |var |let |(\s*)/g, "");

          // Remove TypeScript type annotation (e.g., ": React.FC" or ": () => void")
          // Match pattern: identifier followed by colon and type
          const typeAnnotationMatch = name.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:.*/);
          if (typeAnnotationMatch) {
            name = typeAnnotationMatch[1];
          }

          return name;
        }
      } else {
        // Method declaration
        return leftPart.replace(/async|public|private|protected|static|export |(\s*)/g, "");
      }
    }

    return "";
  }

  /**
   * 获取代码上下文（最外层父级 + 最近的函数）
   *
   * 规则：
   * - 在类的方法中：返回 [ClassName, methodName]
   * - 在普通函数中：返回 [functionName]
   * - 在嵌套函数中：返回 [outerFunction, innerFunction]
   *
   * @param document - VS Code 文档
   * @param line - 行号（0-based）
   * @returns [最外层父级名称, 最近的上下文名称] 或 []
   */
  public getContextNames(document: vscode.TextDocument, line: number): string[] {
    const contexts: Array<{
      line: number;
      name: string;
      type: "class" | "function";
      indent: number;
    }> = [];

    // 向上查找所有的类和函数
    let currentLine = line;
    while (currentLine >= 0) {
      const lineText = document.lineAt(currentLine).text;
      const indent = this.getIndentLevel(lineText);

      // 检查是否是类声明
      if (this.isClassDeclaration(lineText)) {
        const className = this.extractClassName(lineText);
        if (className) {
          contexts.push({ line: currentLine, name: className, type: "class", indent });
        }
      }

      // 检查是否是函数声明（已经排除了 if/while/for 等）
      if (this.isFunctionDeclaration(lineText)) {
        const functionName = this.extractFunctionName(lineText);
        // 额外验证：确保提取的名称不是空字符串，且不是控制语句关键字
        if (functionName && !this.isControlKeyword(functionName)) {
          contexts.push({ line: currentLine, name: functionName, type: "function", indent });
        }
      }

      currentLine--;
    }

    // 如果没有找到任何上下文，返回空数组
    if (contexts.length === 0) {
      return [];
    }

    // 如果只有一个上下文，直接返回
    if (contexts.length === 1) {
      return [contexts[0].name];
    }

    // 多个上下文：需要判断是否真正嵌套
    const outermost = contexts[contexts.length - 1];
    const nearest = contexts[0];

    // 如果最外层和最近的是同一个，只返回一个
    if (outermost.line === nearest.line) {
      return [outermost.name];
    }

    // 检查缩进级别：如果缩进相同，说明是平级的，不是嵌套关系
    if (outermost.indent === nearest.indent) {
      // 平级函数，只返回最近的
      return [nearest.name];
    }

    // 真正的嵌套关系：返回最外层 + 最近的
    return [outermost.name, nearest.name];
  }

  /**
   * 获取行的缩进级别（前导空格数）
   */
  private getIndentLevel(line: string): number {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }

  /**
   * 检查是否是控制语句关键字
   */
  private isControlKeyword(name: string): boolean {
    const keywords = ["if", "else", "while", "for", "switch", "catch", "try", "finally"];
    return keywords.includes(name);
  }

  public findEnclosingBlock(
    document: vscode.TextDocument,
    line: number,
    blockType: JSBlockType
  ): string {
    let currentLine = line;

    while (currentLine >= 0) {
      const lineText = document.lineAt(currentLine).text;

      if (blockType === "class" && this.isClassDeclaration(lineText)) {
        return this.extractClassName(lineText);
      }

      if (blockType === "function" && this.isFunctionDeclaration(lineText)) {
        return this.extractFunctionName(lineText);
      }

      currentLine--;
    }

    return "";
  }

  /**
   * 计算 console.log 的插入行
   *
   * 使用新的插入分析引擎，支持所有 turbo-console-log 的场景：
   * - 函数参数：在函数体开始处插入
   * - 函数调用：在调用结束后插入（支持多行调用）
   * - Return 语句：在 return 之前插入
   * - 条件语句：在条件之前插入
   * - 对象/数组字面量：在声明结束后插入
   * - 函数表达式：在函数体结束后插入
   * - 等等...
   *
   * @param document - VS Code 文档
   * @param selectionLine - 选中的行号（0-based）
   * @param selectedVar - 选中的变量名
   * @returns 插入行号
   */
  public calculateInsertLine(
    document: vscode.TextDocument,
    selectionLine: number,
    selectedVar: string
  ): number {
    const insertLine = this.engine.analyze(document, selectionLine, selectedVar);

    if (insertLine !== null) {
      return insertLine;
    }

    // 如果分析失败（例如语法错误），回退到简单的下一行
    return selectionLine + 1;
  }

  /**
   * 计算缩进
   *
   * 尝试从 AST 获取语句的开始行，以便使用正确的缩进
   * 这对于多行语句特别重要
   *
   * @param document - VS Code 文档
   * @param line - 行号（0-based）
   * @param _tabSize - 制表符大小（未使用，保留以兼容接口）
   * @returns 缩进字符串
   */
  public calculateIndentation(
    document: vscode.TextDocument,
    line: number,
    _tabSize: number
  ): string {
    const statementStartLine = this.engine.getStatementStartLine(document, line);

    const lineToUse = statementStartLine !== null ? statementStartLine : line;

    const currentLineText = document.lineAt(lineToUse).text;
    const leadingSpaces = currentLineText.search(/\S/);

    if (leadingSpaces === -1) {
      return "";
    }

    return " ".repeat(leadingSpaces);
  }

  /**
   * 获取代码上下文类型
   * 用于判断是否需要进行变量扩展
   *
   * @param document - VS Code 文档
   * @param line - 行号（0-based）
   * @param varName - 变量名
   * @returns 上下文类型，如果识别失败返回 null
   */
  public getContextType(
    document: vscode.TextDocument,
    line: number,
    varName: string
  ): string | null {
    return this.engine.getContextType(document, line, varName);
  }

  /**
   * 获取对象变量名
   * 当用户在对象字面量内部选中属性时，返回对象的变量名
   *
   * @param document - VS Code 文档
   * @param line - 行号（0-based）
   * @param propertyName - 属性名
   * @returns 对象变量名，如果找不到返回 null
   */
  public getObjectVariableName(
    document: vscode.TextDocument,
    line: number,
    propertyName: string
  ): string | null {
    return this.engine.getObjectVariableName(document, line, propertyName);
  }

  /**
   * 获取数组变量名
   * 当用户在数组字面量内部选中元素时，返回数组的变量名
   *
   * @param document - VS Code 文档
   * @param line - 行号（0-based）
   * @param elementName - 元素名
   * @returns 数组变量名，如果找不到返回 null
   */
  public getArrayVariableName(
    document: vscode.TextDocument,
    line: number,
    elementName: string
  ): string | null {
    return this.engine.getArrayVariableName(document, line, elementName);
  }

  /**
   * 获取数组元素索引
   * 当用户在数组字面量内部选中元素时，返回该元素在数组中的索引
   *
   * @param document - VS Code 文档
   * @param line - 行号（0-based）
   * @param elementName - 元素名
   * @returns 数组元素索引，如果找不到返回 0
   */
  public getArrayElementIndex(
    document: vscode.TextDocument,
    line: number,
    elementName: string
  ): number {
    return this.engine.getArrayElementIndex(document, line, elementName);
  }
}
