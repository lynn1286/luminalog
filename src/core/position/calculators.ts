import * as vscode from "vscode";
import { ASTNode } from "../ast-utils";
import { CodeContextType } from "../context/types";

/**
 * 位置计算器接口
 * 每个上下文类型都有对应的位置计算器
 */
export interface PositionCalculator {
  /**
   * 计算插入行号
   */
  calculate(
    tree: ASTNode,
    document: vscode.TextDocument,
    targetLine: number,
    targetVariable: string
  ): number;
}

/**
 * 位置计算器工厂
 * 根据上下文类型返回对应的计算器
 */
export class PositionCalculatorFactory {
  private calculators: Map<CodeContextType, PositionCalculator>;

  constructor() {
    this.calculators = new Map();
    this.registerCalculators();
  }

  /**
   * 注册所有计算器
   */
  private registerCalculators(): void {
    this.calculators.set(CodeContextType.ClassDeclaration, new ClassDeclarationCalculator());
    this.calculators.set(CodeContextType.FunctionParam, new FunctionParamCalculator());
    this.calculators.set(CodeContextType.FunctionCallResult, new FunctionCallResultCalculator());
    this.calculators.set(
      CodeContextType.ObjectMethodCallResult,
      new ObjectMethodCallResultCalculator()
    );
    this.calculators.set(CodeContextType.ReturnExpression, new ReturnExpressionCalculator());
    this.calculators.set(
      CodeContextType.ConditionalExpression,
      new ConditionalExpressionCalculator()
    );
    this.calculators.set(CodeContextType.ObjectLiteral, new ObjectLiteralCalculator());
    this.calculators.set(CodeContextType.ArrayLiteral, new ArrayLiteralCalculator());
    this.calculators.set(CodeContextType.TemplateLiteral, new TemplateLiteralCalculator());
    this.calculators.set(CodeContextType.BinaryOperation, new BinaryOperationCalculator());
    this.calculators.set(CodeContextType.TernaryOperation, new TernaryOperationCalculator());
    this.calculators.set(CodeContextType.FunctionExpression, new FunctionExpressionCalculator());
    this.calculators.set(CodeContextType.PropertyAccess, new PropertyAccessCalculator());
    this.calculators.set(CodeContextType.SimpleAssignment, new SimpleAssignmentCalculator());
    this.calculators.set(
      CodeContextType.StandaloneMethodCall,
      new StandaloneMethodCallCalculator()
    );
    this.calculators.set(
      CodeContextType.StandalonePropertyAccess,
      new StandalonePropertyAccessCalculator()
    );
    this.calculators.set(CodeContextType.ExpressionStatement, new ExpressionStatementCalculator());
    this.calculators.set(CodeContextType.InsideObjectLiteral, new InsideObjectLiteralCalculator());
    this.calculators.set(CodeContextType.InsideArrayLiteral, new InsideArrayLiteralCalculator());
  }

  /**
   * 获取计算器
   */
  public getCalculator(contextType: CodeContextType): PositionCalculator {
    const calculator = this.calculators.get(contextType);
    if (!calculator) {
      // 默认计算器
      return new SimpleAssignmentCalculator();
    }
    return calculator;
  }
}

// ========== 具体的计算器实现 ==========

import {
  walk,
  isIdentifier,
  isFunctionDeclaration,
  isFunctionExpression,
  isArrowFunctionExpression,
  isMethodDefinition,
  isBlockStatement,
  isVariableDeclaration,
  isCallExpression,
  isObjectPattern,
  isArrayPattern,
  isReturnStatement,
  getNodeLineRange,
  getNodeStart,
  getNodeEnd,
} from "../ast-utils";

/**
 * 函数参数计算器
 * 在函数体开始处插入
 */
class FunctionParamCalculator implements PositionCalculator {
  calculate(
    tree: ASTNode,
    document: vscode.TextDocument,
    targetLine: number,
    targetVariable: string
  ): number {
    const paramNode = this.findParamNode(tree, document, targetLine, targetVariable);
    if (!paramNode) {
      return targetLine + 1;
    }

    const functionNode = this.findContainingFunction(tree, paramNode);
    if (!functionNode) {
      return targetLine + 1;
    }

    const functionBody = functionNode.body;
    if (functionBody && isBlockStatement(functionBody)) {
      const start = getNodeStart(functionBody);
      if (start === undefined) {
        return targetLine + 1;
      }

      const bracePosition = document.positionAt(start);
      const braceLine = bracePosition.line;
      const braceText = document.lineAt(braceLine).text;

      // 检查是否是空函数体
      if (/\{\s*\}/.test(braceText)) {
        return braceLine + 1;
      }

      // 检查花括号是否在行尾
      const braceAtEnd = braceText.trim().endsWith("{");
      return braceAtEnd ? braceLine + 1 : braceLine;
    }

    return targetLine + 1;
  }

  private findParamNode(
    tree: ASTNode,
    document: vscode.TextDocument,
    targetLine: number,
    targetVariable: string
  ): ASTNode | null {
    let result: ASTNode | null = null;
    let closestDistance = Infinity;

    walk(tree, (node: ASTNode): boolean | void => {
      if (isIdentifier(node) && node.name === targetVariable) {
        const start = getNodeStart(node);
        if (start === undefined) return;

        const nodeLine = document.positionAt(start).line;
        if (nodeLine === targetLine && this.isWithinParams(tree, node)) {
          // 检查是否在类型注解中
          if (this.isInTypeAnnotation(tree, node)) {
            return; // 跳过类型注解中的标识符
          }

          // 如果有多个匹配，选择最接近目标位置的
          const nodeColumn = document.positionAt(start).character;
          const distance = Math.abs(nodeColumn);
          if (distance < closestDistance) {
            closestDistance = distance;
            result = node;
          }
        }
      }
      return false;
    });

    return result;
  }

  /**
   * 检查节点是否在类型注解中
   */
  private isInTypeAnnotation(tree: ASTNode, targetNode: ASTNode): boolean {
    let inTypeAnnotation = false;

    walk(tree, (node: ASTNode): boolean | void => {
      // TypeScript 类型注解节点类型
      if (
        node.type === "TSTypeAnnotation" ||
        node.type === "TSTypeReference" ||
        node.type === "TSTypeLiteral" ||
        node.type === "TSPropertySignature" ||
        node.type === "TSInterfaceBody" ||
        node.type === "TSTypeAliasDeclaration"
      ) {
        if (this.nodeContains(node, targetNode)) {
          inTypeAnnotation = true;
          return true;
        }
      }
      return false;
    });

    return inTypeAnnotation;
  }

  private isWithinParams(tree: ASTNode, targetNode: ASTNode): boolean {
    let isParam = false;

    walk(tree, (node: ASTNode): boolean | void => {
      if (this.isFunctionNode(node)) {
        const params = node.params;
        if (params) {
          for (const param of params) {
            if (this.nodeContains(param, targetNode)) {
              isParam = true;
              return true;
            }
          }
        }
      }
      return false;
    });

    return isParam;
  }

  private findContainingFunction(tree: ASTNode, paramNode: ASTNode): ASTNode | null {
    let result: ASTNode | null = null;

    walk(tree, (node: ASTNode): boolean | void => {
      if (this.isFunctionNode(node)) {
        const params = node.params;
        if (params) {
          for (const param of params) {
            if (this.nodeContains(param, paramNode)) {
              result = node;
              return true;
            }
          }
        }
      }
      return false;
    });

    return result;
  }

  private isFunctionNode(node: ASTNode): boolean {
    return (
      isFunctionDeclaration(node) ||
      isFunctionExpression(node) ||
      isArrowFunctionExpression(node) ||
      isMethodDefinition(node) ||
      node.type === "ClassMethod"
    );
  }

  private nodeContains(parent: ASTNode, child: ASTNode): boolean {
    if (!parent || !child) return false;
    if (parent === child) return true;

    let found = false;
    walk(parent, (node: ASTNode) => {
      if (node === child) {
        found = true;
        return true;
      }
      return false;
    });

    return found;
  }
}

/**
 * 函数调用结果计算器
 * 在函数调用结束后插入
 */
class FunctionCallResultCalculator implements PositionCalculator {
  calculate(
    tree: ASTNode,
    document: vscode.TextDocument,
    targetLine: number,
    targetVariable: string
  ): number {
    let targetEndOffset = -1;
    let smallestRange = Infinity; // 跟踪最小的范围

    walk(tree, (node: ASTNode): boolean | void => {
      if (node.type === "VariableDeclaration") {
        for (const declarator of node.declarations) {
          const declStart = getNodeStart(declarator);
          const declEnd = getNodeEnd(declarator);
          if (declStart === undefined || declEnd === undefined) continue;

          const matchesId = this.matchesDeclaratorPattern(declarator.id, targetVariable);

          if (!matchesId || !declarator.init) continue;

          const unwrappedInit = this.unwrapExpression(declarator.init);

          if (isFunctionExpression(unwrappedInit) || isArrowFunctionExpression(unwrappedInit)) {
            continue;
          }

          if (!this.hasCallExpression(unwrappedInit)) continue;

          const nodeStart = getNodeStart(node);
          const nodeEnd = getNodeEnd(node);
          if (nodeStart === undefined || nodeEnd === undefined) continue;

          const range = getNodeLineRange(node, document);
          if (!range) continue;

          if (targetLine >= range.startLine && targetLine <= range.endLine) {
            // 计算范围大小
            const rangeSize = range.endLine - range.startLine;

            // 只保留最小范围的声明
            if (rangeSize < smallestRange) {
              smallestRange = rangeSize;
              // 使用 VariableDeclaration 的 end，而不是 init 的 end
              targetEndOffset = nodeEnd;
            }
          }
        }
      }
      return false;
    });

    if (targetEndOffset === -1) {
      return targetLine + 1;
    }

    const endLine = document.positionAt(targetEndOffset).line;
    return endLine + 1;
  }

  private hasCallExpression(node: ASTNode): boolean {
    if (!node) return false;

    if (isCallExpression(node)) return true;

    if (node.type === "AwaitExpression" && node.argument) {
      return this.hasCallExpression(node.argument);
    }

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

  private matchesDeclaratorPattern(pattern: ASTNode, targetVariable: string): boolean {
    if (isIdentifier(pattern) && pattern.name === targetVariable) {
      return true;
    }

    if (pattern.type === "AssignmentPattern") {
      return this.matchesDeclaratorPattern(pattern.left, targetVariable);
    }

    if (pattern.type === "RestElement") {
      return this.matchesDeclaratorPattern(pattern.argument, targetVariable);
    }

    if (isObjectPattern(pattern)) {
      for (const property of pattern.properties) {
        if (
          property.type === "Property" &&
          this.matchesDeclaratorPattern(property.value, targetVariable)
        ) {
          return true;
        }

        if (
          property.type === "RestElement" &&
          this.matchesDeclaratorPattern(property.argument, targetVariable)
        ) {
          return true;
        }
      }
    }

    if (isArrayPattern(pattern)) {
      for (const element of pattern.elements) {
        if (element && this.matchesDeclaratorPattern(element, targetVariable)) {
          return true;
        }
      }
    }

    return false;
  }

  private unwrapExpression(node: ASTNode): ASTNode {
    let current = node;

    while (
      current &&
      (current.type === "TSAsExpression" ||
        current.type === "TSTypeAssertion" ||
        current.type === "ParenthesizedExpression" ||
        current.type === "AwaitExpression")
    ) {
      current = current.expression || current.argument;
    }

    return current;
  }
}

/**
 * 对象方法调用结果计算器
 */
class ObjectMethodCallResultCalculator extends FunctionCallResultCalculator {}

/**
 * Return 表达式计算器
 * 在 return 语句之前插入
 */
class ReturnExpressionCalculator implements PositionCalculator {
  calculate(
    tree: ASTNode,
    document: vscode.TextDocument,
    targetLine: number,
    targetVariable: string
  ): number {
    let returnNode: ASTNode | null = null;

    walk(tree, (node: ASTNode): boolean | void => {
      if (isReturnStatement(node) && node.argument) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const returnStmt = node as any; // Type assertion for return statement
        const start = getNodeStart(returnStmt);
        const end = getNodeEnd(returnStmt);
        if (start === undefined || end === undefined) return;

        const startLine = document.positionAt(start).line;
        const endLine = document.positionAt(end).line;

        if (targetLine >= startLine && targetLine <= endLine) {
          // 如果 targetVariable 包含点号、括号或问号（属性链或函数调用），
          // 检查 return 语句的文本是否包含这个表达式
          if (
            targetVariable.includes(".") ||
            targetVariable.includes("(") ||
            targetVariable.includes("?")
          ) {
            const returnText = document.getText(
              new vscode.Range(document.positionAt(start), document.positionAt(end))
            );
            if (returnText.includes(targetVariable)) {
              returnNode = returnStmt;
              return true;
            }
          } else {
            // 简单变量名，使用原来的逻辑
            if (this.containsVariable(returnStmt.argument, targetVariable)) {
              returnNode = returnStmt;
              return true;
            }
          }
        }
      }
      return false;
    });

    if (returnNode) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const returnStart = getNodeStart(returnNode as any);
      if (returnStart !== undefined) {
        const returnStartLine = document.positionAt(returnStart).line;
        return returnStartLine;
      }
    }

    return targetLine + 1;
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
}

/**
 * 条件表达式计算器
 * 在条件语句之前插入，确保无论条件是否成立都能打印日志
 */
class ConditionalExpressionCalculator implements PositionCalculator {
  calculate(
    tree: ASTNode,
    document: vscode.TextDocument,
    targetLine: number,
    _targetVariable: string
  ): number {
    // 查找包含目标行的条件语句节点
    let conditionalNode: ASTNode | null = null;
    let isTernary = false;

    walk(tree, (node: ASTNode): boolean | void => {
      if (
        (node.type === "IfStatement" ||
          node.type === "WhileStatement" ||
          node.type === "ForStatement") &&
        node.test
      ) {
        const testStart = getNodeStart(node.test);
        const testEnd = getNodeEnd(node.test);
        if (testStart === undefined || testEnd === undefined) return;

        const startLine = document.positionAt(testStart).line;
        const endLine = document.positionAt(testEnd).line;

        if (targetLine >= startLine && targetLine <= endLine) {
          conditionalNode = node;
          isTernary = false;
          return true;
        }
      }

      // 三元运算符：在条件表达式所在行之后插入
      if (node.type === "ConditionalExpression" && node.test) {
        const testStart = getNodeStart(node.test);
        const testEnd = getNodeEnd(node.test);
        if (testStart === undefined || testEnd === undefined) return;

        const startLine = document.positionAt(testStart).line;
        const endLine = document.positionAt(testEnd).line;

        if (targetLine >= startLine && targetLine <= endLine) {
          conditionalNode = node;
          isTernary = true;
          return true;
        }
      }
      return false;
    });

    // 三元运算符没有独立语句体，保持在当前表达式所在行之前插入
    if (isTernary) {
      return targetLine;
    }

    if (conditionalNode) {
      const conditionalStart = getNodeStart(conditionalNode);
      if (conditionalStart !== undefined) {
        return document.positionAt(conditionalStart).line;
      }
    }

    // 默认在当前行之后插入
    return targetLine + 1;
  }
}

/**
 * 对象字面量计算器
 */
class ObjectLiteralCalculator implements PositionCalculator {
  calculate(
    tree: ASTNode,
    document: vscode.TextDocument,
    targetLine: number,
    _targetVariable: string
  ): number {
    return this.findDeclarationEnd(tree, document, targetLine);
  }

  private findDeclarationEnd(
    tree: ASTNode,
    document: vscode.TextDocument,
    targetLine: number
  ): number {
    let endOffset = -1;
    let smallestRange = Infinity; // 跟踪最小的范围

    walk(tree, (node: ASTNode): boolean | void => {
      // 处理变量声明：const obj = { ... }
      if (isVariableDeclaration(node)) {
        // 遍历每个声明器（declarator）
        for (const declarator of node.declarations) {
          const declStart = getNodeStart(declarator);
          const declEnd = getNodeEnd(declarator);
          if (declStart === undefined || declEnd === undefined) continue;

          const declStartLine = document.positionAt(declStart).line;
          const declEndLine = document.positionAt(declEnd).line;

          // 检查目标行是否在这个声明器的范围内
          if (targetLine >= declStartLine && targetLine <= declEndLine) {
            // 计算范围大小
            const rangeSize = declEndLine - declStartLine;

            // 只保留最小范围的声明
            if (rangeSize < smallestRange) {
              smallestRange = rangeSize;
              // 使用声明器的结束位置，而不是整个 VariableDeclaration 的结束位置
              endOffset = declEnd;
            }
          }
        }
      }

      // 处理赋值表达式：obj = { ... }
      if (node.type === "AssignmentExpression") {
        const assignStart = getNodeStart(node);
        const assignEnd = getNodeEnd(node);
        if (assignStart === undefined || assignEnd === undefined) return;

        const assignStartLine = document.positionAt(assignStart).line;
        const assignEndLine = document.positionAt(assignEnd).line;

        // 检查目标行是否在这个赋值表达式的范围内
        if (targetLine >= assignStartLine && targetLine <= assignEndLine) {
          // 计算范围大小
          const rangeSize = assignEndLine - assignStartLine;

          // 只保留最小范围的赋值
          if (rangeSize < smallestRange) {
            smallestRange = rangeSize;
            endOffset = assignEnd;
          }
        }
      }

      return false;
    });

    if (endOffset === -1) {
      return targetLine + 1;
    }

    return document.positionAt(endOffset).line + 1;
  }
}

/**
 * 数组字面量计算器
 */
class ArrayLiteralCalculator extends ObjectLiteralCalculator {}

/**
 * 模板字符串计算器
 * 在变量声明的下一行插入
 */
class TemplateLiteralCalculator implements PositionCalculator {
  calculate(
    tree: ASTNode,
    document: vscode.TextDocument,
    targetLine: number,
    targetVariable: string
  ): number {
    let targetEndOffset = -1;
    let smallestRange = Infinity; // 跟踪最小的范围

    walk(tree, (node: ASTNode): boolean | void => {
      if (isVariableDeclaration(node)) {
        for (const declarator of node.declarations) {
          if (isIdentifier(declarator.id) && declarator.id.name === targetVariable) {
            const range = getNodeLineRange(node, document);
            if (range && targetLine >= range.startLine && targetLine <= range.endLine) {
              // 计算范围大小
              const rangeSize = range.endLine - range.startLine;

              // 只保留最小范围的声明
              if (rangeSize < smallestRange) {
                smallestRange = rangeSize;
                const nodeEnd = getNodeEnd(node);
                if (nodeEnd !== undefined) {
                  targetEndOffset = nodeEnd;
                }
              }
            }
          }
        }
      }
      return false;
    });

    if (targetEndOffset === -1) {
      return targetLine + 1;
    }

    const endLine = document.positionAt(targetEndOffset).line;
    return endLine + 1;
  }
}

/**
 * 二元运算计算器
 */
class BinaryOperationCalculator extends ObjectLiteralCalculator {}

/**
 * 三元运算计算器
 */
class TernaryOperationCalculator extends ObjectLiteralCalculator {}

/**
 * 函数表达式计算器
 * 在函数体结束后插入
 */
class FunctionExpressionCalculator implements PositionCalculator {
  calculate(
    tree: ASTNode,
    document: vscode.TextDocument,
    targetLine: number,
    targetVariable: string
  ): number {
    let functionNode: ASTNode | null = null;
    let smallestRange = Infinity; // 跟踪最小的范围

    walk(tree, (node: ASTNode): boolean | void => {
      if (isVariableDeclaration(node)) {
        for (const declarator of node.declarations) {
          if (!declarator.loc) continue;

          const declStartLine = declarator.loc.start.line - 1;
          const declEndLine = declarator.loc.end.line - 1;

          if (targetLine < declStartLine || targetLine > declEndLine) continue;

          if (
            isIdentifier(declarator.id) &&
            declarator.id.name === targetVariable &&
            declarator.init
          ) {
            const unwrapped = this.unwrapExpression(declarator.init);
            if (isFunctionExpression(unwrapped) || isArrowFunctionExpression(unwrapped)) {
              // 计算范围大小
              const rangeSize = declEndLine - declStartLine;

              // 只保留最小范围的声明
              if (rangeSize < smallestRange) {
                smallestRange = rangeSize;
                functionNode = unwrapped;
              }
            }
          }
        }
      }
      return false;
    });

    if (functionNode) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body = (functionNode as any).body;
      if (body && isBlockStatement(body)) {
        const bodyEnd = getNodeEnd(body);
        if (bodyEnd !== undefined) {
          return document.positionAt(bodyEnd).line + 1;
        }
      }
    }

    return targetLine + 1;
  }

  private unwrapExpression(node: ASTNode): ASTNode {
    let current = node;

    while (
      current &&
      (current.type === "TSAsExpression" ||
        current.type === "TSTypeAssertion" ||
        current.type === "ParenthesizedExpression")
    ) {
      current = current.expression;
    }

    return current;
  }
}

/**
 * 属性访问计算器
 */
class PropertyAccessCalculator extends ObjectLiteralCalculator {}

/**
 * 简单赋值计算器（默认）
 * 在变量声明的下一行插入
 */
class SimpleAssignmentCalculator implements PositionCalculator {
  calculate(
    tree: ASTNode,
    document: vscode.TextDocument,
    targetLine: number,
    targetVariable: string
  ): number {
    // 找到目标变量的声明
    let targetDeclaration: ASTNode | null = null;
    let smallestRange = Infinity; // 跟踪最小的范围

    walk(tree, (node: ASTNode): boolean | void => {
      if (isVariableDeclaration(node)) {
        for (const declarator of node.declarations) {
          if (!this.matchesDeclarator(declarator.id, targetVariable)) {
            continue;
          }

          const range = getNodeLineRange(node, document);
          if (range && targetLine >= range.startLine && targetLine <= range.endLine) {
            // 计算范围大小
            const rangeSize = range.endLine - range.startLine;

            // 只保留最小范围的声明
            if (rangeSize < smallestRange) {
              smallestRange = rangeSize;
              targetDeclaration = node;
            }
          }
        }
      }
      return false;
    });

    if (!targetDeclaration) {
      return targetLine + 1;
    }

    // 获取目标声明的结束行
    const targetEnd = getNodeEnd(targetDeclaration);
    if (targetEnd === undefined) {
      return targetLine + 1;
    }

    // 直接在目标声明的下一行插入
    const endLine = document.positionAt(targetEnd).line;
    return endLine + 1;
  }

  private matchesDeclarator(pattern: ASTNode, targetVariable: string): boolean {
    if (isIdentifier(pattern) && pattern.name === targetVariable) {
      return true;
    }

    if (pattern.type === "AssignmentPattern") {
      return this.matchesDeclarator(pattern.left, targetVariable);
    }

    if (pattern.type === "RestElement") {
      return this.matchesDeclarator(pattern.argument, targetVariable);
    }

    if (isObjectPattern(pattern)) {
      for (const prop of pattern.properties) {
        if (prop.type === "Property" && this.matchesDeclarator(prop.value, targetVariable)) {
          return true;
        }

        if (prop.type === "RestElement" && this.matchesDeclarator(prop.argument, targetVariable)) {
          return true;
        }
      }
    }

    if (isArrayPattern(pattern)) {
      for (const element of pattern.elements) {
        if (element && this.matchesDeclarator(element, targetVariable)) {
          return true;
        }
      }
    }

    return false;
  }
}

class StandaloneMethodCallCalculator extends SimpleAssignmentCalculator {}

/**
 * 独立属性访问计算器
 */
class StandalonePropertyAccessCalculator extends SimpleAssignmentCalculator {}

/**
 * 表达式语句计算器
 */
class ExpressionStatementCalculator extends SimpleAssignmentCalculator {}

/**
 * 对象字面量内部计算器
 * 在对象字面量外部插入
 */
class InsideObjectLiteralCalculator implements PositionCalculator {
  calculate(
    tree: ASTNode,
    document: vscode.TextDocument,
    targetLine: number,
    _targetVariable: string
  ): number {
    let objectNode: ASTNode | null = null;
    let smallestRange = Infinity;

    walk(tree, (node: ASTNode): boolean | void => {
      // 查找包含目标行的对象表达式
      if (node.type === "ObjectExpression") {
        const objStart = getNodeStart(node);
        const objEnd = getNodeEnd(node);
        if (objStart === undefined || objEnd === undefined) return;

        const startLine = document.positionAt(objStart).line;
        const endLine = document.positionAt(objEnd).line;

        // 检查目标行是否在对象内部
        if (targetLine > startLine && targetLine < endLine) {
          const rangeSize = endLine - startLine;
          if (rangeSize < smallestRange) {
            smallestRange = rangeSize;
            objectNode = node;
          }
        }
      }
      return false;
    });

    if (objectNode) {
      // 找到包含这个对象的变量声明或赋值表达式
      const parentEnd = this.findParentEnd(tree, objectNode);
      if (parentEnd !== -1) {
        const insertLine = document.positionAt(parentEnd).line + 1;
        return insertLine;
      }
    }

    return targetLine + 1;
  }

  private findParentEnd(tree: ASTNode, objectNode: ASTNode): number {
    let endOffset = -1;
    let smallestDepth = Infinity;

    walk(tree, (node: ASTNode): boolean | void => {
      // 查找变量声明语句
      if (isVariableDeclaration(node)) {
        for (const declarator of node.declarations) {
          // 检查是否是直接赋值
          if (declarator.init === objectNode) {
            const stmtEnd = getNodeEnd(node);
            if (stmtEnd !== undefined) {
              endOffset = stmtEnd;
              return true; // 找到直接赋值，立即返回
            }
          }

          // 检查是否包含在 init 中
          if (declarator.init && this.nodeContains(declarator.init, objectNode)) {
            const depth = this.calculateNodeDepth(declarator.init, objectNode);

            if (depth < smallestDepth) {
              const stmtEnd = getNodeEnd(node);
              if (stmtEnd !== undefined) {
                smallestDepth = depth;
                endOffset = stmtEnd;
              }
            }
          }
        }
      }

      // 查找赋值表达式语句
      if (node.type === "ExpressionStatement") {
        const expr = node.expression;
        if (expr && expr.type === "AssignmentExpression") {
          // 检查是否是直接赋值
          if (expr.right === objectNode) {
            const stmtEnd = getNodeEnd(node);
            if (stmtEnd !== undefined) {
              endOffset = stmtEnd;
              return true;
            }
          }

          // 检查是否包含在 right 中
          if (expr.right && this.nodeContains(expr.right, objectNode)) {
            const depth = this.calculateNodeDepth(expr.right, objectNode);

            if (depth < smallestDepth) {
              const stmtEnd = getNodeEnd(node);
              if (stmtEnd !== undefined) {
                smallestDepth = depth;
                endOffset = stmtEnd;
              }
            }
          }
        }

        // 查找函数调用表达式语句（独立的函数调用）
        if (expr && isCallExpression(expr)) {
          if (this.nodeContains(expr, objectNode)) {
            const depth = this.calculateNodeDepth(expr, objectNode);

            if (depth < smallestDepth) {
              const stmtEnd = getNodeEnd(node);
              if (stmtEnd !== undefined) {
                smallestDepth = depth;
                endOffset = stmtEnd;
              }
            }
          }
        }
      }

      return false;
    });

    return endOffset;
  }

  /**
   * 计算从父节点到子节点的嵌套深度
   */
  private calculateNodeDepth(parent: any, child: any): number {
    if (parent === child) return 0;

    let minDepth = Infinity;

    const traverse = (node: any, depth: number): void => {
      if (node === child) {
        minDepth = Math.min(minDepth, depth);
        return;
      }

      if (!node || typeof node !== "object") return;

      for (const key in node) {
        if (key === "loc" || key === "range" || key === "start" || key === "end") {
          continue;
        }

        const value = node[key];
        if (value && typeof value === "object") {
          if (Array.isArray(value)) {
            for (const item of value) {
              traverse(item, depth + 1);
            }
          } else {
            traverse(value, depth + 1);
          }
        }
      }
    };

    traverse(parent, 0);
    return minDepth;
  }

  private nodeContains(parent: ASTNode | null | undefined, child: ASTNode): boolean {
    if (!parent || !child) return false;
    if (parent === child) return true;

    let found = false;
    walk(parent, (node: ASTNode) => {
      if (node === child) {
        found = true;
        return true;
      }
      return false;
    });

    return found;
  }
}

/**
 * 数组字面量内部计算器
 * 在数组字面量外部插入
 */
class InsideArrayLiteralCalculator implements PositionCalculator {
  calculate(
    tree: ASTNode,
    document: vscode.TextDocument,
    targetLine: number,
    _targetVariable: string
  ): number {
    let arrayNode: ASTNode | null = null;
    let smallestRange = Infinity;

    walk(tree, (node: ASTNode): boolean | void => {
      // 查找包含目标行的数组表达式
      if (node.type === "ArrayExpression") {
        const arrStart = getNodeStart(node);
        const arrEnd = getNodeEnd(node);
        if (arrStart === undefined || arrEnd === undefined) return;

        const startLine = document.positionAt(arrStart).line;
        const endLine = document.positionAt(arrEnd).line;

        // 检查目标行是否在数组内部
        if (targetLine > startLine && targetLine < endLine) {
          const rangeSize = endLine - startLine;
          if (rangeSize < smallestRange) {
            smallestRange = rangeSize;
            arrayNode = node;
          }
        }
      }
      return false;
    });

    if (arrayNode) {
      // 找到包含这个数组的变量声明或赋值表达式
      const parentEnd = this.findParentEnd(tree, arrayNode);
      if (parentEnd !== -1) {
        const insertLine = document.positionAt(parentEnd).line + 1;
        return insertLine;
      }
    }

    return targetLine + 1;
  }

  private findParentEnd(tree: ASTNode, arrayNode: ASTNode): number {
    let endOffset = -1;

    walk(tree, (node: ASTNode): boolean | void => {
      // 查找变量声明语句
      if (isVariableDeclaration(node)) {
        for (const declarator of node.declarations) {
          if (declarator.init === arrayNode || this.nodeContains(declarator.init, arrayNode)) {
            // 获取整个变量声明语句的结束位置
            const stmtEnd = getNodeEnd(node);
            if (stmtEnd !== undefined) {
              endOffset = stmtEnd;
              return true;
            }
          }
        }
      }

      // 查找赋值表达式语句
      if (node.type === "ExpressionStatement") {
        const expr = node.expression;
        if (expr && expr.type === "AssignmentExpression") {
          if (expr.right === arrayNode || this.nodeContains(expr.right, arrayNode)) {
            // 获取整个表达式语句的结束位置
            const stmtEnd = getNodeEnd(node);
            if (stmtEnd !== undefined) {
              endOffset = stmtEnd;
              return true;
            }
          }
        }

        // 查找函数调用表达式语句（独立的函数调用）
        if (expr && isCallExpression(expr)) {
          if (this.nodeContains(expr, arrayNode)) {
            // 获取整个表达式语句的结束位置
            const stmtEnd = getNodeEnd(node);
            if (stmtEnd !== undefined) {
              endOffset = stmtEnd;
              return true;
            }
          }
        }
      }

      return false;
    });

    return endOffset;
  }

  private nodeContains(parent: ASTNode | null | undefined, child: ASTNode): boolean {
    if (!parent || !child) return false;
    if (parent === child) return true;

    let found = false;
    walk(parent, (node: ASTNode) => {
      if (node === child) {
        found = true;
        return true;
      }
      return false;
    });

    return found;
  }
}

/**
 * 类声明计算器
 * 当选中类名时，在类声明结束后插入
 */
class ClassDeclarationCalculator implements PositionCalculator {
  calculate(
    tree: ASTNode,
    document: vscode.TextDocument,
    targetLine: number,
    _targetVariable: string
  ): number {
    let classNode: ASTNode | null = null;

    walk(tree, (node: ASTNode): boolean | void => {
      if (node.type === "ClassDeclaration") {
        const classStart = getNodeStart(node);
        if (classStart === undefined) return;

        const classStartLine = document.positionAt(classStart).line;

        // 获取类体开始位置
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const classBody = (node as any).body;
        if (classBody && classBody.type === "ClassBody") {
          const bodyStart = getNodeStart(classBody);
          if (bodyStart !== undefined) {
            const bodyStartLine = document.positionAt(bodyStart).line;

            // 如果目标行在类声明行（从类开始到类体开始），则匹配
            if (targetLine >= classStartLine && targetLine <= bodyStartLine) {
              classNode = node;
              return true;
            }
          }
        }
      }
      return false;
    });

    if (classNode) {
      // 在类声明结束后插入
      const classEnd = getNodeEnd(classNode);
      if (classEnd !== undefined) {
        const classEndLine = document.positionAt(classEnd).line;
        return classEndLine + 1;
      }
    }

    // 默认在当前行之后插入
    return targetLine + 1;
  }
}
