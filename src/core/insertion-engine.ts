import * as vscode from "vscode";
import path from "path";
import { parseCode, getNodeStart } from "./ast-utils";
import { ContextRecognizer } from "./context/recognizer";
import { PositionCalculatorFactory } from "./position/calculators";

/**
 * 插入位置分析引擎
 * 这是整个系统的核心，协调上下文识别和位置计算
 */
export class InsertionAnalysisEngine {
  private contextRecognizer: ContextRecognizer;
  private calculatorFactory: PositionCalculatorFactory;

  constructor() {
    this.contextRecognizer = new ContextRecognizer();
    this.calculatorFactory = new PositionCalculatorFactory();
  }

  /**
   * 分析并返回插入行号
   *
   * @param document - VS Code 文档
   * @param targetLine - 目标行号（0-based）
   * @param targetVariable - 目标变量名
   * @returns 插入行号，如果分析失败返回 null
   */
  public analyze(
    document: vscode.TextDocument,
    targetLine: number,
    targetVariable: string
  ): number | null {
    // 1. 解析代码为 AST
    const sourceCode = document.getText();
    const filePath = document.uri.fsPath;
    const fileExtension = path.extname(filePath);

    const syntaxTree = parseCode(sourceCode, fileExtension);
    if (!syntaxTree) {
      return null; // 解析失败，回退到简单方法
    }

    // 2. 识别代码上下文
    const context = this.contextRecognizer.recognize(document, targetLine, targetVariable);
    if (!context) {
      return targetLine + 1; // 默认插入到下一行
    }

    // 3. 获取对应的位置计算器
    const calculator = this.calculatorFactory.getCalculator(context.type);

    // 4. 计算插入位置
    const insertLine = calculator.calculate(syntaxTree, document, targetLine, targetVariable);

    return insertLine;
  }

  /**
   * 获取代码上下文类型
   * 用于判断是否需要进行变量扩展
   *
   * @param document - VS Code 文档
   * @param targetLine - 目标行号（0-based）
   * @param targetVariable - 目标变量名
   * @returns 上下文类型，如果识别失败返回 null
   */
  public getContextType(
    document: vscode.TextDocument,
    targetLine: number,
    targetVariable: string
  ): string | null {
    const context = this.contextRecognizer.recognize(document, targetLine, targetVariable);
    return context ? context.type : null;
  }

  /**
   * 获取对象变量名
   * 当用户在对象字面量内部选中属性时，返回对象的变量名
   *
   * @param document - VS Code 文档
   * @param targetLine - 目标行号（0-based）
   * @param propertyName - 属性名
   * @returns 对象变量名，如果找不到返回 null
   */
  public getObjectVariableName(
    document: vscode.TextDocument,
    targetLine: number,
    propertyName: string
  ): string | null {
    const sourceCode = document.getText();
    const filePath = document.uri.fsPath;
    const fileExtension = path.extname(filePath);

    const syntaxTree = parseCode(sourceCode, fileExtension);
    if (!syntaxTree) {
      return null;
    }

    return this.contextRecognizer.findObjectVariableName(
      document,
      syntaxTree,
      targetLine,
      propertyName
    );
  }

  /**
   * 获取数组变量名
   * 当用户在数组字面量内部选中元素时，返回数组的变量名
   *
   * @param document - VS Code 文档
   * @param targetLine - 目标行号（0-based）
   * @param elementName - 元素名
   * @returns 数组变量名，如果找不到返回 null
   */
  public getArrayVariableName(
    document: vscode.TextDocument,
    targetLine: number,
    elementName: string
  ): string | null {
    const sourceCode = document.getText();
    const filePath = document.uri.fsPath;
    const fileExtension = path.extname(filePath);

    const syntaxTree = parseCode(sourceCode, fileExtension);
    if (!syntaxTree) {
      return null;
    }

    return this.contextRecognizer.findArrayVariableName(
      document,
      syntaxTree,
      targetLine,
      elementName
    );
  }

  /**
   * 获取数组元素索引
   * 当用户在数组字面量内部选中元素时，返回该元素在数组中的索引
   *
   * @param document - VS Code 文档
   * @param targetLine - 目标行号（0-based）
   * @param elementName - 元素名
   * @returns 数组元素索引，如果找不到返回 0
   */
  public getArrayElementIndex(
    document: vscode.TextDocument,
    targetLine: number,
    elementName: string
  ): number {
    const sourceCode = document.getText();
    const filePath = document.uri.fsPath;
    const fileExtension = path.extname(filePath);

    const syntaxTree = parseCode(sourceCode, fileExtension);
    if (!syntaxTree) {
      return 0;
    }

    return this.contextRecognizer.findArrayElementIndex(
      document,
      syntaxTree,
      targetLine,
      elementName
    );
  }

  /**
   * 获取语句的开始行
   * 用于计算缩进
   *
   * @param document - VS Code 文档
   * @param targetLine - 目标行号（0-based）
   * @returns 语句开始行号，如果分析失败返回 null
   */
  public getStatementStartLine(document: vscode.TextDocument, targetLine: number): number | null {
    const sourceCode = document.getText();
    const filePath = document.uri.fsPath;
    const fileExtension = path.extname(filePath);

    const syntaxTree = parseCode(sourceCode, fileExtension);
    if (!syntaxTree) {
      return null;
    }

    const statement = this.findStatementAtLine(syntaxTree, targetLine);
    if (!statement) {
      return null;
    }

    if (statement.loc) {
      return statement.loc.start.line - 1;
    }

    const start = getNodeStart(statement);
    if (start !== undefined) {
      const startPosition = document.positionAt(start);
      return startPosition.line;
    }

    return null;
  }

  /**
   * 查找包含指定行的语句
   */
  private findStatementAtLine(tree: any, line: number): any | null {
    if (!tree || tree.type !== "Program") {
      return null;
    }

    return this.findStatementInBody(tree.body, line);
  }

  /**
   * 在语句数组中递归查找
   */
  private findStatementInBody(body: any[], line: number): any | null {
    for (const statement of body) {
      if (!statement.loc) {
        continue;
      }

      const startLine = statement.loc.start.line - 1;
      const endLine = statement.loc.end.line - 1;

      if (startLine <= line && endLine >= line) {
        const nestedBody = this.getNestedBody(statement);

        if (nestedBody && nestedBody.length > 0) {
          const nestedStatement = this.findStatementInBody(nestedBody, line);
          if (nestedStatement) {
            return nestedStatement;
          }
        }

        return statement;
      }
    }

    return null;
  }

  /**
   * 获取节点的嵌套语句体
   */
  private getNestedBody(node: any): any[] | null {
    if (
      node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression"
    ) {
      if (node.body && node.body.type === "BlockStatement") {
        return node.body.body;
      }
    }

    if (node.type === "BlockStatement") {
      return node.body;
    }

    if (node.type === "IfStatement") {
      const bodies: any[] = [];
      if (node.consequent) {
        if (node.consequent.type === "BlockStatement") {
          bodies.push(...node.consequent.body);
        } else {
          bodies.push(node.consequent);
        }
      }
      if (node.alternate) {
        if (node.alternate.type === "BlockStatement") {
          bodies.push(...node.alternate.body);
        } else {
          bodies.push(node.alternate);
        }
      }
      return bodies.length > 0 ? bodies : null;
    }

    if (
      node.type === "ForStatement" ||
      node.type === "WhileStatement" ||
      node.type === "DoWhileStatement"
    ) {
      if (node.body && node.body.type === "BlockStatement") {
        return node.body.body;
      }
    }

    return null;
  }
}
