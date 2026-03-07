import * as vscode from "vscode";
import { ASTNode, parseCode, walk, getNodeStart, getNodeEnd } from "../ast-utils";
import { CodeContext, CodeContextType } from "./types";
import {
  isIdentifier,
  isCallExpression,
  isAwaitExpression,
  isReturnStatement,
  isIfStatement,
  isConditionalExpression,
  isObjectExpression,
  isArrayExpression,
  isTemplateLiteral,
  isBinaryExpression,
  isLogicalExpression,
  isFunctionExpression,
  isArrowFunctionExpression,
  isMemberExpression,
  isVariableDeclaration,
  isObjectPattern,
  isArrayPattern,
} from "../ast-utils";

/**
 * 上下文识别器
 * 负责识别选中变量所在的代码上下文
 */
export class ContextRecognizer {
  /**
   * 识别代码上下文
   */
  public recognize(
    document: vscode.TextDocument,
    targetLine: number,
    targetVariable: string
  ): CodeContext | null {
    const sourceCode = document.getText();
    const filePath = document.uri.fsPath;
    const fileExt = filePath.substring(filePath.lastIndexOf("."));

    const syntaxTree = parseCode(sourceCode, fileExt);
    if (!syntaxTree) {
      return null;
    }

    // 按优先级检查各种上下文
    const recognizers = [
      this.recognizeClassDeclaration.bind(this), // 类声明优先级最高
      this.recognizeFunctionParam.bind(this),
      this.recognizeReturnExpression.bind(this),
      this.recognizeConditionalExpression.bind(this),
      this.recognizeTernaryOperation.bind(this), // 三元运算符优先级提高
      this.recognizeObjectMethodCallResult.bind(this), // 对象方法调用优先于普通函数调用
      this.recognizeFunctionCallResult.bind(this),
      this.recognizeStandaloneMethodCall.bind(this),
      this.recognizeObjectLiteral.bind(this),
      this.recognizeArrayLiteral.bind(this),
      this.recognizeTemplateLiteral.bind(this),
      this.recognizeBinaryOperation.bind(this),
      this.recognizeFunctionExpression.bind(this),
      this.recognizePropertyAccess.bind(this),
      this.recognizeStandalonePropertyAccess.bind(this),
      this.recognizeExpressionStatement.bind(this),
      this.recognizeInsideObjectLiteral.bind(this), // 最低优先级：对象内部
      this.recognizeInsideArrayLiteral.bind(this), // 最低优先级：数组内部
    ];

    for (const recognizer of recognizers) {
      const context = recognizer(syntaxTree, document, targetLine, targetVariable);
      if (context) {
        return context;
      }
    }

    // 默认：简单赋值
    return {
      type: CodeContextType.SimpleAssignment,
    };
  }

  /**
   * 识别类声明
   * 只要选中的内容在类声明行上，就识别为类声明上下文
   */
  private recognizeClassDeclaration(
    tree: ASTNode,
    doc: vscode.TextDocument,
    line: number,
    _varName: string
  ): CodeContext | null {
    let found = false;

    walk(tree, (node: ASTNode): boolean | void => {
      if (found) return true;

      // 检查是否是类声明
      if (node.type === "ClassDeclaration") {
        const classStart = getNodeStart(node);
        if (classStart === undefined) return;

        const classStartLine = doc.positionAt(classStart).line;

        // 获取类体开始位置（开括号位置）
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const classBody = (node as any).body;
        if (classBody && classBody.type === "ClassBody") {
          const bodyStart = getNodeStart(classBody);
          if (bodyStart !== undefined) {
            const bodyStartLine = doc.positionAt(bodyStart).line;

            // 如果目标行在类声明开始行到类体开始行之间（包含类体开始行），则识别为类声明
            // 这样可以处理单行和多行类声明
            if (line >= classStartLine && line <= bodyStartLine) {
              found = true;
              return true;
            }
          }
        }
      }
    });

    return found ? { type: CodeContextType.ClassDeclaration } : null;
  }

  /**
   * 识别函数参数
   */
  private recognizeFunctionParam(
    tree: ASTNode,
    doc: vscode.TextDocument,
    line: number,
    varName: string
  ): CodeContext | null {
    let found = false;

    walk(tree, (node: ASTNode): boolean | void => {
      if (found) return true;

      if (this.isFunctionNode(node)) {
        const parameters = node.params;
        if (!parameters || !Array.isArray(parameters)) return;

        for (const param of parameters) {
          const paramStart = getNodeStart(param);
          if (paramStart === undefined) continue;

          const paramLine = doc.positionAt(paramStart).line;
          const paramEnd = getNodeEnd(param);
          const paramEndLine = paramEnd ? doc.positionAt(paramEnd).line : paramLine;

          if (line >= paramLine && line <= paramEndLine) {
            if (this.matchesParameter(param, varName)) {
              found = true;
              return true;
            }
          }
        }
      }
    });

    return found ? { type: CodeContextType.FunctionParam } : null;
  }

  /**
   * 识别 return 语句中的表达式
   */
  private recognizeReturnExpression(
    tree: ASTNode,
    doc: vscode.TextDocument,
    line: number,
    varName: string
  ): CodeContext | null {
    let found = false;

    walk(tree, (node: ASTNode): boolean | void => {
      if (found) return true;

      if (isReturnStatement(node) && node.argument) {
        const nodeStart = getNodeStart(node);
        const nodeEnd = getNodeEnd(node);
        if (nodeStart === undefined || nodeEnd === undefined) return;

        const startLine = doc.positionAt(nodeStart).line;
        const endLine = doc.positionAt(nodeEnd).line;

        if (line >= startLine && line <= endLine) {
          if (this.containsVariable(node.argument, varName)) {
            found = true;
            return true;
          }
        }
      }
    });

    return found ? { type: CodeContextType.ReturnExpression } : null;
  }

  /**
   * 识别条件表达式
   */
  private recognizeConditionalExpression(
    tree: ASTNode,
    doc: vscode.TextDocument,
    line: number,
    varName: string
  ): CodeContext | null {
    let found = false;

    walk(tree, (node: ASTNode): boolean | void => {
      if (found) return true;

      // if/while/for 等条件语句
      if (
        (isIfStatement(node) || node.type === "WhileStatement" || node.type === "ForStatement") &&
        node.test
      ) {
        const testStart = getNodeStart(node.test);
        const testEnd = getNodeEnd(node.test);
        if (testStart === undefined || testEnd === undefined) return;

        const startLine = doc.positionAt(testStart).line;
        const endLine = doc.positionAt(testEnd).line;

        if (line >= startLine && line <= endLine) {
          if (this.containsVariable(node.test, varName)) {
            found = true;
            return true;
          }
        }
      }

      // 三元运算符的条件部分
      if (isConditionalExpression(node)) {
        if (node.test) {
          const testStart = getNodeStart(node.test);
          const testEnd = getNodeEnd(node.test);
          if (testStart !== undefined && testEnd !== undefined) {
            const startLine = doc.positionAt(testStart).line;
            const endLine = doc.positionAt(testEnd).line;

            if (line >= startLine && line <= endLine) {
              if (this.containsVariable(node.test, varName)) {
                found = true;
                return true;
              }
            }
          }
        }
      }
    });

    return found ? { type: CodeContextType.ConditionalExpression } : null;
  }

  /**
   * 识别函数调用返回值
   */
  private recognizeFunctionCallResult(
    tree: ASTNode,
    _doc: vscode.TextDocument,
    line: number,
    varName: string
  ): CodeContext | null {
    let found = false;
    let isAsync = false;

    walk(tree, (node: ASTNode): boolean | void => {
      if (found) return true;

      if (isVariableDeclaration(node)) {
        for (const declarator of node.declarations) {
          if (!declarator.loc) continue;

          const declStartLine = declarator.loc.start.line - 1;
          const declEndLine = declarator.loc.end.line - 1;

          if (line < declStartLine || line > declEndLine) continue;

          const { id, init } = declarator;
          if (!init) continue;

          const matchesId =
            (isIdentifier(id) && id.name === varName) || isObjectPattern(id) || isArrayPattern(id);

          if (matchesId && this.hasCallExpression(init)) {
            isAsync = isAwaitExpression(init);
            found = true;
            return true;
          }
        }
      }
    });

    return found
      ? {
          type: CodeContextType.FunctionCallResult,
          metadata: { isAsync },
        }
      : null;
  }

  /**
   * 识别对象方法调用返回值
   */
  private recognizeObjectMethodCallResult(
    tree: ASTNode,
    _doc: vscode.TextDocument,
    line: number,
    varName: string
  ): CodeContext | null {
    let found = false;

    walk(tree, (node: ASTNode): boolean | void => {
      if (found) return true;

      if (isVariableDeclaration(node)) {
        for (const declarator of node.declarations) {
          if (!declarator.loc) continue;

          const declStartLine = declarator.loc.start.line - 1;
          const declEndLine = declarator.loc.end.line - 1;

          if (line < declStartLine || line > declEndLine) continue;

          const { id, init } = declarator;
          if (!init) continue;

          if (isIdentifier(id) && id.name === varName) {
            const unwrapped = this.unwrapExpression(init);
            if (isCallExpression(unwrapped) && isMemberExpression(unwrapped.callee)) {
              found = true;
              return true;
            }
          }
        }
      }
    });

    return found ? { type: CodeContextType.ObjectMethodCallResult } : null;
  }

  /**
   * 识别独立的方法调用
   */
  private recognizeStandaloneMethodCall(
    _tree: ASTNode,
    _doc: vscode.TextDocument,
    _line: number,
    _varName: string
  ): CodeContext | null {
    // TODO: 实现独立方法调用识别
    return null;
  }

  /**
   * 识别对象字面量
   */
  private recognizeObjectLiteral(
    tree: ASTNode,
    doc: vscode.TextDocument,
    line: number,
    varName: string
  ): CodeContext | null {
    let found = false;

    walk(tree, (node: ASTNode): boolean | void => {
      if (found) return true;

      // 处理变量声明：const obj = { ... }
      if (isVariableDeclaration(node)) {
        for (const declarator of node.declarations) {
          if (!declarator.loc) continue;

          const declStartLine = declarator.loc.start.line - 1;
          const declEndLine = declarator.loc.end.line - 1;

          if (line < declStartLine || line > declEndLine) continue;

          const { id, init } = declarator;
          if (isIdentifier(id) && id.name === varName && init && isObjectExpression(init)) {
            found = true;
            return true;
          }
        }
      }

      // 处理赋值表达式：obj = { ... }
      if (node.type === "AssignmentExpression") {
        const left = node.left;
        const right = node.right;

        // 检查左边是否是目标变量
        if (isIdentifier(left) && left.name === varName && isObjectExpression(right)) {
          // 检查赋值表达式是否包含目标行
          const assignStart = getNodeStart(node);
          const assignEnd = getNodeEnd(node);
          if (assignStart !== undefined && assignEnd !== undefined) {
            const startLine = doc.positionAt(assignStart).line;
            const endLine = doc.positionAt(assignEnd).line;

            if (line >= startLine && line <= endLine) {
              found = true;
              return true;
            }
          }
        }
      }
    });

    return found ? { type: CodeContextType.ObjectLiteral } : null;
  }

  /**
   * 识别数组字面量
   */
  private recognizeArrayLiteral(
    tree: ASTNode,
    _doc: vscode.TextDocument,
    line: number,
    varName: string
  ): CodeContext | null {
    let found = false;

    walk(tree, (node: ASTNode): boolean | void => {
      if (found) return true;

      if (isVariableDeclaration(node)) {
        for (const declarator of node.declarations) {
          if (!declarator.loc) continue;

          const declStartLine = declarator.loc.start.line - 1;
          const declEndLine = declarator.loc.end.line - 1;

          if (line < declStartLine || line > declEndLine) continue;

          const { id, init } = declarator;
          if (isIdentifier(id) && id.name === varName && init && isArrayExpression(init)) {
            found = true;
            return true;
          }
        }
      }
    });

    return found ? { type: CodeContextType.ArrayLiteral } : null;
  }

  /**
   * 识别模板字符串
   */
  private recognizeTemplateLiteral(
    tree: ASTNode,
    _doc: vscode.TextDocument,
    line: number,
    varName: string
  ): CodeContext | null {
    let found = false;

    walk(tree, (node: ASTNode): boolean | void => {
      if (found) return true;

      if (isVariableDeclaration(node)) {
        for (const declarator of node.declarations) {
          if (!declarator.loc) continue;

          const declStartLine = declarator.loc.start.line - 1;
          const declEndLine = declarator.loc.end.line - 1;

          if (line < declStartLine || line > declEndLine) continue;

          const { id, init } = declarator;
          if (isIdentifier(id) && id.name === varName && init) {
            // 检查 init 本身是否是模板字符串，或者包含模板字符串
            if (this.containsTemplateLiteral(init)) {
              found = true;
              return true;
            }
          }
        }
      }
    });

    return found ? { type: CodeContextType.TemplateLiteral } : null;
  }

  /**
   * 检查节点是否包含模板字符串
   */
  private containsTemplateLiteral(node: ASTNode): boolean {
    if (!node) return false;

    if (isTemplateLiteral(node)) return true;

    // 检查逻辑表达式（||, &&）
    if (isLogicalExpression(node)) {
      return this.containsTemplateLiteral(node.left) || this.containsTemplateLiteral(node.right);
    }

    // 检查三元运算符
    if (isConditionalExpression(node)) {
      return (
        this.containsTemplateLiteral(node.consequent) ||
        this.containsTemplateLiteral(node.alternate)
      );
    }

    // 检查括号表达式
    if (node.type === "ParenthesizedExpression" && node.expression) {
      return this.containsTemplateLiteral(node.expression);
    }

    return false;
  }

  /**
   * 识别二元运算
   */
  private recognizeBinaryOperation(
    tree: ASTNode,
    _doc: vscode.TextDocument,
    line: number,
    varName: string
  ): CodeContext | null {
    let found = false;

    walk(tree, (node: ASTNode): boolean | void => {
      if (found) return true;

      if (isVariableDeclaration(node)) {
        for (const declarator of node.declarations) {
          if (!declarator.loc) continue;

          const declStartLine = declarator.loc.start.line - 1;
          const declEndLine = declarator.loc.end.line - 1;

          if (line < declStartLine || line > declEndLine) continue;

          const { id, init } = declarator;
          if (isIdentifier(id) && id.name === varName && init && isBinaryExpression(init)) {
            found = true;
            return true;
          }
        }
      }
    });

    return found ? { type: CodeContextType.BinaryOperation } : null;
  }

  /**
   * 识别三元运算
   */
  private recognizeTernaryOperation(
    tree: ASTNode,
    _doc: vscode.TextDocument,
    line: number,
    varName: string
  ): CodeContext | null {
    let found = false;

    walk(tree, (node: ASTNode): boolean | void => {
      if (found) return true;

      if (isVariableDeclaration(node)) {
        for (const declarator of node.declarations) {
          if (!declarator.loc) continue;

          const declStartLine = declarator.loc.start.line - 1;
          const declEndLine = declarator.loc.end.line - 1;

          if (line < declStartLine || line > declEndLine) continue;

          const { id, init } = declarator;
          if (isIdentifier(id) && id.name === varName && init && isConditionalExpression(init)) {
            found = true;
            return true;
          }
        }
      }
    });

    return found ? { type: CodeContextType.TernaryOperation } : null;
  }

  /**
   * 识别函数表达式
   */
  private recognizeFunctionExpression(
    tree: ASTNode,
    _doc: vscode.TextDocument,
    line: number,
    varName: string
  ): CodeContext | null {
    let found = false;

    walk(tree, (node: ASTNode): boolean | void => {
      if (found) return true;

      if (isVariableDeclaration(node)) {
        for (const declarator of node.declarations) {
          if (!declarator.loc) continue;

          const declStartLine = declarator.loc.start.line - 1;
          const declEndLine = declarator.loc.end.line - 1;

          if (line < declStartLine || line > declEndLine) continue;

          const { id, init } = declarator;
          if (!init) continue;

          const unwrapped = this.unwrapExpression(init);
          if (
            isIdentifier(id) &&
            id.name === varName &&
            (isFunctionExpression(unwrapped) || isArrowFunctionExpression(unwrapped))
          ) {
            found = true;
            return true;
          }
        }
      }
    });

    return found ? { type: CodeContextType.FunctionExpression } : null;
  }

  /**
   * 识别属性访问
   */
  private recognizePropertyAccess(
    tree: ASTNode,
    _doc: vscode.TextDocument,
    line: number,
    varName: string
  ): CodeContext | null {
    let found = false;

    walk(tree, (node: ASTNode): boolean | void => {
      if (found) return true;

      if (isVariableDeclaration(node)) {
        for (const declarator of node.declarations) {
          if (!declarator.loc) continue;

          const declStartLine = declarator.loc.start.line - 1;
          const declEndLine = declarator.loc.end.line - 1;

          if (line < declStartLine || line > declEndLine) continue;

          const { id, init } = declarator;
          if (isIdentifier(id) && id.name === varName && init && isMemberExpression(init)) {
            found = true;
            return true;
          }
        }
      }
    });

    return found ? { type: CodeContextType.PropertyAccess } : null;
  }

  /**
   * 识别独立的属性访问
   */
  private recognizeStandalonePropertyAccess(
    _tree: ASTNode,
    _doc: vscode.TextDocument,
    _line: number,
    _varName: string
  ): CodeContext | null {
    // TODO: 实现独立属性访问识别
    return null;
  }

  /**
   * 识别表达式语句
   */
  private recognizeExpressionStatement(
    _tree: ASTNode,
    _doc: vscode.TextDocument,
    _line: number,
    _varName: string
  ): CodeContext | null {
    // TODO: 实现表达式语句识别
    return null;
  }

  // ========== 辅助方法 ==========

  private isFunctionNode(node: ASTNode): boolean {
    return (
      node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression" ||
      node.type === "MethodDefinition" ||
      node.type === "ClassMethod"
    );
  }

  private matchesParameter(param: ASTNode, varName: string): boolean {
    if (isIdentifier(param) && param.name === varName) {
      return true;
    }

    if (param.type === "AssignmentPattern") {
      return this.matchesParameter(param.left, varName);
    }

    if (param.type === "RestElement") {
      return this.matchesParameter(param.argument, varName);
    }

    if (param.type === "ObjectPattern") {
      for (const prop of param.properties) {
        if (prop.type === "Property" && this.matchesParameter(prop.value, varName)) {
          return true;
        }
        if (prop.type === "RestElement" && this.matchesParameter(prop.argument, varName)) {
          return true;
        }
      }
    }

    if (param.type === "ArrayPattern") {
      for (const element of param.elements) {
        if (element && this.matchesParameter(element, varName)) {
          return true;
        }
      }
    }

    return false;
  }

  private containsVariable(node: ASTNode, varName: string): boolean {
    if (!node) return false;

    if (isIdentifier(node) && node.name === varName) {
      return true;
    }

    let found = false;
    walk(node, (child: ASTNode) => {
      if (isIdentifier(child) && child.name === varName) {
        found = true;
        return true;
      }
      return false;
    });

    return found;
  }

  private hasCallExpression(node: ASTNode): boolean {
    if (!node) return false;

    const unwrapped = this.unwrapExpression(node);
    if (isCallExpression(unwrapped)) return true;

    let found = false;
    walk(node, (child: ASTNode) => {
      if (isCallExpression(child)) {
        found = true;
        return true;
      }
      return false;
    });

    return found;
  }

  private unwrapExpression(node: ASTNode): ASTNode {
    let current = node;

    while (
      current &&
      (current.type === "TSAsExpression" ||
        current.type === "TSTypeAssertion" ||
        current.type === "ParenthesizedExpression" ||
        isAwaitExpression(current))
    ) {
      current = current.expression || current.argument;
    }

    return current;
  }

  /**
   * 识别对象字面量内部
   * 当用户在对象字面量内部选中变量时，应该在对象外部插入
   */
  private recognizeInsideObjectLiteral(
    tree: ASTNode,
    doc: vscode.TextDocument,
    line: number,
    varName: string
  ): CodeContext | null {
    let found = false;
    let parentObjectNode: ASTNode | null = null;

    walk(tree, (node: ASTNode): boolean | void => {
      if (found) return true;

      // 查找对象表达式
      if (isObjectExpression(node)) {
        const objStart = getNodeStart(node);
        const objEnd = getNodeEnd(node);
        if (objStart === undefined || objEnd === undefined) return;

        const startLine = doc.positionAt(objStart).line;
        const endLine = doc.positionAt(objEnd).line;

        // 检查目标行是否在对象内部
        if (line > startLine && line < endLine) {
          // 检查对象内部是否包含目标变量
          if (this.containsVariable(node, varName)) {
            found = true;
            parentObjectNode = node;
            return true;
          }
        }
      }
    });

    if (found && parentObjectNode) {
      return {
        type: CodeContextType.InsideObjectLiteral,
        metadata: {
          expressionText: varName,
        },
      };
    }

    return null;
  }

  /**
   * 识别数组字面量内部
   * 当用户在数组字面量内部选中变量时，应该在数组外部插入
   */
  private recognizeInsideArrayLiteral(
    tree: ASTNode,
    doc: vscode.TextDocument,
    line: number,
    varName: string
  ): CodeContext | null {
    let found = false;
    let parentArrayNode: ASTNode | null = null;

    walk(tree, (node: ASTNode): boolean | void => {
      if (found) return true;

      // 查找数组表达式
      if (isArrayExpression(node)) {
        const arrStart = getNodeStart(node);
        const arrEnd = getNodeEnd(node);
        if (arrStart === undefined || arrEnd === undefined) return;

        const startLine = doc.positionAt(arrStart).line;
        const endLine = doc.positionAt(arrEnd).line;

        // 检查目标行是否在数组内部
        if (line > startLine && line < endLine) {
          // 检查数组内部是否包含目标变量
          if (this.containsVariable(node, varName)) {
            found = true;
            parentArrayNode = node;
            return true;
          }
        }
      }
    });

    if (found && parentArrayNode) {
      return {
        type: CodeContextType.InsideArrayLiteral,
        metadata: {
          expressionText: varName,
        },
      };
    }

    return null;
  }

  /**
   * 查找对象变量名
   * 当用户在对象字面量内部选中属性时，返回对象的变量名
   * 如果对象在数组内部，返回数组名
   */
  public findObjectVariableName(
    doc: vscode.TextDocument,
    tree: ASTNode,
    line: number,
    _propertyName: string
  ): string | null {
    let objectVarName: string | null = null;
    let smallestRange = Infinity;
    let targetObjectNode: ASTNode | null = null;

    walk(tree, (node: ASTNode): boolean | void => {
      // 查找包含目标行的对象表达式
      if (node.type === "ObjectExpression") {
        const objStart = getNodeStart(node);
        const objEnd = getNodeEnd(node);
        if (objStart === undefined || objEnd === undefined) return;

        const startLine = doc.positionAt(objStart).line;
        const endLine = doc.positionAt(objEnd).line;

        // 检查目标行是否在对象内部
        if (line > startLine && line < endLine) {
          const rangeSize = endLine - startLine;
          if (rangeSize < smallestRange) {
            smallestRange = rangeSize;
            targetObjectNode = node;
            // 找到这个对象对应的变量名
            objectVarName = this.findVariableNameForNode(tree, node);
          }
        }
      }
    });

    // 如果找不到对象变量名，检查对象是否在数组内部
    if (!objectVarName && targetObjectNode) {
      objectVarName = this.findParentArrayName(tree, doc, targetObjectNode);
    }

    return objectVarName;
  }

  /**
   * 查找数组变量名
   * 当用户在数组字面量内部选中元素时，返回数组的变量名
   */
  public findArrayVariableName(
    doc: vscode.TextDocument,
    tree: ASTNode,
    line: number,
    _elementName: string
  ): string | null {
    let arrayVarName: string | null = null;
    let smallestRange = Infinity;

    walk(tree, (node: ASTNode): boolean | void => {
      // 查找包含目标行的数组表达式
      if (node.type === "ArrayExpression") {
        const arrStart = getNodeStart(node);
        const arrEnd = getNodeEnd(node);
        if (arrStart === undefined || arrEnd === undefined) return;

        const startLine = doc.positionAt(arrStart).line;
        const endLine = doc.positionAt(arrEnd).line;

        // 检查目标行是否在数组内部
        if (line > startLine && line < endLine) {
          const rangeSize = endLine - startLine;
          if (rangeSize < smallestRange) {
            smallestRange = rangeSize;
            // 找到这个数组对应的变量名
            arrayVarName = this.findVariableNameForNode(tree, node);
          }
        }
      }
    });

    return arrayVarName;
  }

  /**
   * 查找数组元素的索引
   * 当用户在数组字面量内部选中元素时，返回该元素在数组中的索引
   */
  public findArrayElementIndex(
    doc: vscode.TextDocument,
    tree: ASTNode,
    line: number,
    _elementName: string
  ): number {
    let elementIndex = 0;
    let smallestRange = Infinity;

    walk(tree, (node: ASTNode): boolean | void => {
      // 查找包含目标行的数组表达式
      if (node.type === "ArrayExpression") {
        const arrStart = getNodeStart(node);
        const arrEnd = getNodeEnd(node);
        if (arrStart === undefined || arrEnd === undefined) return;

        const startLine = doc.positionAt(arrStart).line;
        const endLine = doc.positionAt(arrEnd).line;

        // 检查目标行是否在数组内部
        if (line > startLine && line < endLine) {
          const rangeSize = endLine - startLine;
          if (rangeSize < smallestRange) {
            smallestRange = rangeSize;

            // 遍历数组元素，找到包含目标行的元素
            const elements = node.elements || [];
            for (let i = 0; i < elements.length; i++) {
              const element = elements[i];
              if (!element) continue; // 跳过空元素 (如 [1, , 3])

              const elemStart = getNodeStart(element);
              const elemEnd = getNodeEnd(element);
              if (elemStart === undefined || elemEnd === undefined) continue;

              const elemStartLine = doc.positionAt(elemStart).line;
              const elemEndLine = doc.positionAt(elemEnd).line;

              // 检查目标行是否在这个元素内部
              if (line >= elemStartLine && line <= elemEndLine) {
                elementIndex = i;
                break;
              }
            }
          }
        }
      }
    });

    return elementIndex;
  }

  /**
   * 查找节点对应的变量名
   * 遍历 AST，找到包含该节点的变量声明或赋值表达式
   */
  private findVariableNameForNode(tree: ASTNode, targetNode: ASTNode): string | null {
    let varName: string | null = null;

    walk(tree, (node: ASTNode): boolean | void => {
      // 查找变量声明
      if (isVariableDeclaration(node)) {
        for (const declarator of node.declarations) {
          if (declarator.init === targetNode || this.nodeContains(declarator.init, targetNode)) {
            if (isIdentifier(declarator.id)) {
              varName = declarator.id.name;
              return true;
            }
          }
        }
      }

      // 查找赋值表达式
      if (node.type === "AssignmentExpression") {
        const left = node.left;
        const right = node.right;
        if (right === targetNode || this.nodeContains(right, targetNode)) {
          if (isIdentifier(left)) {
            varName = left.name;
            return true;
          }
        }
      }
    });

    return varName;
  }

  /**
   * 查找包含对象的父数组名
   * 当对象是数组元素时，返回数组的变量名
   */
  private findParentArrayName(
    tree: ASTNode,
    _doc: vscode.TextDocument,
    objectNode: ASTNode
  ): string | null {
    let arrayVarName: string | null = null;

    walk(tree, (node: ASTNode): boolean | void => {
      // 查找数组表达式
      if (node.type === "ArrayExpression") {
        // 检查数组是否包含这个对象
        if (this.nodeContains(node, objectNode)) {
          // 找到这个数组对应的变量名
          arrayVarName = this.findVariableNameForNode(tree, node);
          return true;
        }
      }
    });

    return arrayVarName;
  }

  /**
   * 检查父节点是否包含子节点
   */
  private nodeContains(parent: any, child: any): boolean {
    if (!parent || !child) return false;
    if (parent === child) return true;

    // 递归检查所有属性
    for (const key in parent) {
      if (key === "loc" || key === "range" || key === "start" || key === "end") {
        continue;
      }

      const value = parent[key];
      if (value && typeof value === "object") {
        if (Array.isArray(value)) {
          for (const item of value) {
            if (this.nodeContains(item, child)) {
              return true;
            }
          }
        } else {
          if (this.nodeContains(value, child)) {
            return true;
          }
        }
      }
    }

    return false;
  }
}
