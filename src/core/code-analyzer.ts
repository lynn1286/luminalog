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
    const isNamed = REGEX.NAMED_FUNCTION.test(line);
    const isNonNamed = REGEX.NON_NAMED_FUNCTION.test(line);
    const isExpression = REGEX.FUNCTION_EXPRESSION.test(line);
    return (isNamed && !isNonNamed) || isExpression;
  }

  public isBuiltInStatement(line: string): boolean {
    return REGEX.JS_BUILT_IN.test(line);
  }

  public extractClassName(line: string): string {
    if (line.split(/class /).length >= 2) {
      const textAfterClass = line.split(/class /)[1].trim();
      const className = textAfterClass.split(" ")[0].replace("{", "");
      return className || textAfterClass.replace("{", "");
    }
    return "";
  }

  public extractFunctionName(line: string): string {
    // Handle: function name() {}
    if (/function(\s+)[a-zA-Z]+(\s*)\(.*\)(\s*){/.test(line)) {
      if (line.split("function ").length > 1) {
        return line.split("function ")[1].split("(")[0].replace(/(\s*)/g, "");
      }
    }

    // Handle: const name = () => {} or name() {}
    if (line.split(/\(.*\)/).length > 0) {
      const leftPart = line.split(/\(.*\)/)[0];

      // Has assignment
      if (/=/.test(leftPart)) {
        if (leftPart.split("=").length > 0) {
          return leftPart
            .split("=")[0]
            .replace(/export |module.exports |const |var |let |=|(\s*)/g, "");
        }
      } else {
        // Method declaration
        return leftPart.replace(/async|public|private|protected|static|export |(\s*)/g, "");
      }
    }

    return "";
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
