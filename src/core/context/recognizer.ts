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
   * 转义正则表达式中的特殊字符
   */
  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

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
      this.recognizeInterfaceProperty.bind(this),
      this.recognizeEnumMember.bind(this),
      this.recognizeTypeAliasProperty.bind(this),
      this.recognizeTypeUtilityKeyword.bind(this),
      this.recognizeTypeReference.bind(this),
      this.recognizeTypeAliasDeclaration.bind(this),
      this.recognizeInterfaceDeclaration.bind(this),
      this.recognizeEnumDeclaration.bind(this),
      this.recognizeGenericTypeParameter.bind(this),
      this.recognizeTypeAnnotation.bind(this),
      this.recognizeClassDeclaration.bind(this),
      this.recognizeFunctionParam.bind(this), // 函数参数优先于函数声明
      this.recognizeFunctionDeclaration.bind(this),
      this.recognizeReturnExpression.bind(this),
      this.recognizeConditionalExpression.bind(this),
      this.recognizeTernaryOperation.bind(this),
      this.recognizeObjectMethodCallResult.bind(this),
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
      this.recognizeInsideObjectLiteral.bind(this),
      this.recognizeInsideArrayLiteral.bind(this),
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
   * 识别函数声明
   * 只要选中的内容在函数声明行上，就识别为函数声明上下文
   */
  private recognizeFunctionDeclaration(
    tree: ASTNode,
    doc: vscode.TextDocument,
    line: number,
    _varName: string
  ): CodeContext | null {
    let found = false;

    walk(tree, (node: ASTNode): boolean | void => {
      if (found) return true;

      // 检查是否是函数声明
      if (node.type === "FunctionDeclaration") {
        const funcStart = getNodeStart(node);
        if (funcStart === undefined) return;

        const funcStartLine = doc.positionAt(funcStart).line;

        // 获取函数体开始位置（开括号位置）
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const funcBody = (node as any).body;
        if (funcBody) {
          const bodyStart = getNodeStart(funcBody);
          if (bodyStart !== undefined) {
            const bodyStartLine = doc.positionAt(bodyStart).line;

            // 如果选中的行在函数声明行和函数体开始行之间（包括这两行）
            // 说明是在函数声明部分，不是在函数体内部
            if (line >= funcStartLine && line <= bodyStartLine) {
              found = true;
              return true;
            }
          }
        }
      }
    });

    return found ? { type: CodeContextType.FunctionDeclaration } : null;
  }

  /**
   * 识别接口属性
   * interface IProps { className?: string; }
   */
  private recognizeInterfaceProperty(
    _tree: ASTNode,
    doc: vscode.TextDocument,
    line: number,
    varName: string
  ): CodeContext | null {
    // 向上查找，看是否在 interface 块内部
    let currentLine = line;
    let insideInterface = false;
    let interfaceStartLine = -1;

    while (currentLine >= 0) {
      const lineText = doc.lineAt(currentLine).text;

      // 检查是否是 interface 声明行
      if (/\binterface\s+\w+/.test(lineText)) {
        insideInterface = true;
        interfaceStartLine = currentLine;
        break;
      }

      // 如果遇到其他块的开始（class, function, type, enum），说明不在 interface 内
      if (/\b(class|function|type|enum)\s+\w+/.test(lineText) && !/\binterface\s+/.test(lineText)) {
        break;
      }

      currentLine--;
    }

    if (!insideInterface) {
      return null;
    }

    // 检查是否在 interface 块的结束之前
    // 从 interface 声明行向下查找闭合括号
    let braceCount = 0;
    let foundOpenBrace = false;

    for (let i = interfaceStartLine; i < doc.lineCount; i++) {
      const lineText = doc.lineAt(i).text;

      for (const char of lineText) {
        if (char === "{") {
          braceCount++;
          foundOpenBrace = true;
        } else if (char === "}") {
          braceCount--;
          if (braceCount === 0 && foundOpenBrace) {
            // 找到了闭合括号
            if (line > interfaceStartLine && line < i) {
              // 当前行在 interface 块内部
              // 检查当前行是否是属性定义
              const currentLineText = doc.lineAt(line).text;
              const escapedVarName = this.escapeRegExp(varName);
              const propertyPattern = new RegExp(`\\b${escapedVarName}\\s*[?:]`);
              if (propertyPattern.test(currentLineText)) {
                return { type: CodeContextType.InterfaceProperty };
              }
            }
            return null;
          }
        }
      }
    }

    return null;
  }

  /**
   * 识别枚举成员
   * enum Status { Active = 'active' }
   */
  private recognizeEnumMember(
    _tree: ASTNode,
    doc: vscode.TextDocument,
    line: number,
    varName: string
  ): CodeContext | null {
    // 向上查找，看是否在 enum 块内部
    let currentLine = line;
    let insideEnum = false;
    let enumStartLine = -1;

    while (currentLine >= 0) {
      const lineText = doc.lineAt(currentLine).text;

      // 检查是否是 enum 声明行
      if (/\benum\s+\w+/.test(lineText)) {
        insideEnum = true;
        enumStartLine = currentLine;
        break;
      }

      // 如果遇到其他块的开始，说明不在 enum 内
      if (/\b(class|function|type|interface)\s+\w+/.test(lineText)) {
        break;
      }

      currentLine--;
    }

    if (!insideEnum) {
      return null;
    }

    // 检查是否在 enum 块的结束之前
    let braceCount = 0;
    let foundOpenBrace = false;

    for (let i = enumStartLine; i < doc.lineCount; i++) {
      const lineText = doc.lineAt(i).text;

      for (const char of lineText) {
        if (char === "{") {
          braceCount++;
          foundOpenBrace = true;
        } else if (char === "}") {
          braceCount--;
          if (braceCount === 0 && foundOpenBrace) {
            // 找到了闭合括号
            if (line > enumStartLine && line < i) {
              // 当前行在 enum 块内部
              // 检查当前行是否是枚举成员
              const currentLineText = doc.lineAt(line).text;
              const escapedVarName = this.escapeRegExp(varName);
              const memberPattern = new RegExp(`\\b${escapedVarName}\\s*[=,]?`);
              if (memberPattern.test(currentLineText)) {
                return { type: CodeContextType.EnumMember };
              }
            }
            return null;
          }
        }
      }
    }

    return null;
  }

  /**
   * 识别类型别名属性
   * type UserInfo = { name: string; }
   */
  private recognizeTypeAliasProperty(
    _tree: ASTNode,
    doc: vscode.TextDocument,
    line: number,
    varName: string
  ): CodeContext | null {
    // 向上查找，看是否在 type 块内部
    let currentLine = line;
    let insideType = false;
    let typeStartLine = -1;

    while (currentLine >= 0) {
      const lineText = doc.lineAt(currentLine).text;

      // 检查是否是 type 声明行（支持复杂类型：Pick, Omit, Partial 等）
      // 匹配: type Name = { 或 type Name = Pick<...> & { 或 type Name = Omit<...> & {
      if (/\btype\s+\w+\s*=\s*.*\{/.test(lineText)) {
        insideType = true;
        typeStartLine = currentLine;
        break;
      }

      // 如果遇到其他块的开始，说明不在 type 内
      if (/\b(class|function|interface|enum)\s+\w+/.test(lineText)) {
        break;
      }

      currentLine--;
    }

    if (!insideType) {
      return null;
    }

    // 检查是否在 type 块的结束之前
    let braceCount = 0;
    let foundOpenBrace = false;

    for (let i = typeStartLine; i < doc.lineCount; i++) {
      const lineText = doc.lineAt(i).text;

      for (const char of lineText) {
        if (char === "{") {
          braceCount++;
          foundOpenBrace = true;
        } else if (char === "}") {
          braceCount--;
          if (braceCount === 0 && foundOpenBrace) {
            // 找到了闭合括号
            if (line > typeStartLine && line < i) {
              // 当前行在 type 块内部
              // 检查当前行是否是属性定义
              const currentLineText = doc.lineAt(line).text;
              const escapedVarName = this.escapeRegExp(varName);
              const propertyPattern = new RegExp(`\\b${escapedVarName}\\s*[?:]`);
              if (propertyPattern.test(currentLineText)) {
                return { type: CodeContextType.TypeAliasProperty };
              }
            }
            return null;
          }
        }
      }
    }

    return null;
  }

  /**
   * 识别类型工具关键字
   * Pick, Omit, Partial, Required, Record, Exclude, Extract, etc.
   */
  private recognizeTypeUtilityKeyword(
    _tree: ASTNode,
    doc: vscode.TextDocument,
    line: number,
    varName: string
  ): CodeContext | null {
    const lineText = doc.lineAt(line).text;

    // TypeScript 内置类型工具关键字列表
    const typeUtilities = [
      "Pick",
      "Omit",
      "Partial",
      "Required",
      "Readonly",
      "Record",
      "Exclude",
      "Extract",
      "NonNullable",
      "ReturnType",
      "InstanceType",
      "Parameters",
      "ConstructorParameters",
      "Awaited",
    ];

    // 检查变量名是否是类型工具关键字
    if (!typeUtilities.includes(varName)) {
      return null;
    }

    // 检查是否在 type 声明中使用
    // 例如：type Name = Pick<T, K> & { ... }
    if (/\btype\s+\w+\s*=/.test(lineText)) {
      return { type: CodeContextType.TypeUtilityKeyword };
    }

    return null;
  }

  /**
   * 识别类型引用
   * type Name = TypeReference<...> 或 interface Name extends TypeReference
   */
  private recognizeTypeReference(
    _tree: ASTNode,
    doc: vscode.TextDocument,
    line: number,
    varName: string
  ): CodeContext | null {
    const lineText = doc.lineAt(line).text;

    // 检查是否在 type 或 interface 声明的右侧
    // 例如：type Name = ICommonPageList<...>
    // 或：interface Name extends BaseInterface
    const escapedVarName = this.escapeRegExp(varName);
    const typeReferencePattern = new RegExp(
      `\\b(type|interface)\\s+\\w+\\s*(=|extends)\\s*[^=]*\\b${escapedVarName}\\b`
    );

    if (typeReferencePattern.test(lineText)) {
      // 确保不是声明的名称本身
      const declarationNamePattern = new RegExp(`\\b(type|interface)\\s+${escapedVarName}\\b`);
      if (!declarationNamePattern.test(lineText)) {
        return { type: CodeContextType.TypeReference };
      }
    }

    return null;
  }

  /**
   * 识别类型别名声明
   * type UserRole = 'admin' | 'user';
   */
  private recognizeTypeAliasDeclaration(
    _tree: ASTNode,
    doc: vscode.TextDocument,
    line: number,
    varName: string
  ): CodeContext | null {
    const lineText = doc.lineAt(line).text;

    // 检查是否是 type 声明行
    const escapedVarName = this.escapeRegExp(varName);
    const typePattern = new RegExp(`\\btype\\s+${escapedVarName}\\s*[=<]`);
    if (typePattern.test(lineText)) {
      return { type: CodeContextType.TypeAliasDeclaration };
    }

    return null;
  }

  /**
   * 识别接口声明
   * interface IProps { ... }
   */
  private recognizeInterfaceDeclaration(
    _tree: ASTNode,
    doc: vscode.TextDocument,
    line: number,
    varName: string
  ): CodeContext | null {
    const lineText = doc.lineAt(line).text;

    // 检查是否是 interface 声明行
    const escapedVarName = this.escapeRegExp(varName);
    const interfacePattern = new RegExp(`\\binterface\\s+${escapedVarName}\\b`);
    if (interfacePattern.test(lineText)) {
      return { type: CodeContextType.InterfaceDeclaration };
    }

    return null;
  }

  /**
   * 识别枚举声明
   * enum Status { ... }
   */
  private recognizeEnumDeclaration(
    _tree: ASTNode,
    doc: vscode.TextDocument,
    line: number,
    varName: string
  ): CodeContext | null {
    const lineText = doc.lineAt(line).text;

    // 检查是否是 enum 声明行
    const escapedVarName = this.escapeRegExp(varName);
    const enumPattern = new RegExp(`\\benum\\s+${escapedVarName}\\b`);
    if (enumPattern.test(lineText)) {
      return { type: CodeContextType.EnumDeclaration };
    }

    return null;
  }

  /**
   * 识别泛型类型参数
   * React.FC<LayerMoreSettingsProps>
   * Pick<ICommonParams, 'page'>
   */
  private recognizeGenericTypeParameter(
    _tree: ASTNode,
    doc: vscode.TextDocument,
    line: number,
    varName: string
  ): CodeContext | null {
    const lineText = doc.lineAt(line).text;

    // 检查变量是否在尖括号内（泛型参数）
    // 例如：React.FC<LayerMoreSettingsProps> 或 Pick<ICommonParams, 'page'>
    const escapedVarName = this.escapeRegExp(varName);
    const genericPattern = new RegExp(`<[^>]*\\b${escapedVarName}\\b[^>]*>`);
    if (genericPattern.test(lineText)) {
      // 进一步检查：确保不是在赋值语句的右侧
      // 例如：const value = <Component>...</Component> (JSX)
      // 我们要排除 JSX，只匹配类型参数
      const beforeVar = lineText.substring(0, lineText.indexOf(varName));
      // 如果在 < 之后且在 = 之前，很可能是类型参数
      const lastLt = beforeVar.lastIndexOf("<");
      const lastEq = beforeVar.lastIndexOf("=");
      const lastColon = beforeVar.lastIndexOf(":");

      // 类型参数通常出现在：
      // 1. 类型注解中：: Type<Param>
      // 2. 泛型函数/类声明中：function foo<T>() 或 class Foo<T>
      // 3. type 声明中：type Name = Pick<ICommonParams, ...>
      if (
        lastLt > lastEq &&
        (lastColon > lastEq || /\bfunction\b|\bclass\b|\btype\b|\binterface\b/.test(beforeVar))
      ) {
        return { type: CodeContextType.GenericTypeParameter };
      }
    }

    return null;
  }

  /**
   * 识别类型注解
   * name: string, role: UserRole
   */
  private recognizeTypeAnnotation(
    _tree: ASTNode,
    doc: vscode.TextDocument,
    line: number,
    varName: string
  ): CodeContext | null {
    const lineText = doc.lineAt(line).text;

    // 检查变量是否在冒号之后（类型注解）
    // 例如：name: string, role: UserRole
    const escapedVarName = this.escapeRegExp(varName);
    const typeAnnotationPattern = new RegExp(`:\\s*${escapedVarName}\\b`);
    if (typeAnnotationPattern.test(lineText)) {
      // 确保不是对象属性（对象属性也有冒号）
      // 对象属性的模式：key: value，其中 value 可能是变量
      // 类型注解的模式：varName: Type
      const match = lineText.match(new RegExp(`(\\w+)\\s*:\\s*${escapedVarName}\\b`));
      if (match) {
        // 检查前面是否有 const/let/var/function 等关键字
        // 或者在函数参数中
        const beforeMatch = lineText.substring(0, lineText.indexOf(match[0]));
        if (
          /(\b(const|let|var|function|=>)\s*$|\(\s*$)/.test(beforeMatch) ||
          /^\s*$/.test(beforeMatch) ||
          /,\s*$/.test(beforeMatch)
        ) {
          return { type: CodeContextType.TypeAnnotation };
        }
      }
    }

    return null;
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
          if (!this.matchesParameter(param, varName)) {
            continue;
          }

          if (this.isParameterMatchOnLine(param, doc, line, varName)) {
            found = true;
            return true;
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
          // 如果 varName 包含点号、括号或问号（属性链或函数调用），
          // 检查 return 语句的文本是否包含这个表达式
          if (varName.includes(".") || varName.includes("(") || varName.includes("?")) {
            const returnText = doc.getText(
              new vscode.Range(doc.positionAt(nodeStart), doc.positionAt(nodeEnd))
            );
            if (returnText.includes(varName)) {
              found = true;
              return true;
            }
          } else {
            // 简单变量名，使用原来的逻辑
            if (this.containsVariable(node.argument, varName)) {
              found = true;
              return true;
            }
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
          if (
            (varName.includes(".") || varName.includes("(") || varName.includes("?")) &&
            doc
              .getText(new vscode.Range(doc.positionAt(testStart), doc.positionAt(testEnd)))
              .includes(varName)
          ) {
            found = true;
            return true;
          }

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
              if (
                (varName.includes(".") || varName.includes("(") || varName.includes("?")) &&
                doc
                  .getText(new vscode.Range(doc.positionAt(testStart), doc.positionAt(testEnd)))
                  .includes(varName)
              ) {
                found = true;
                return true;
              }

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
          const unwrapped = this.unwrapExpression(init);

          const matchesId = this.matchesDeclaratorPattern(id, varName);

          if (
            matchesId &&
            !isFunctionExpression(unwrapped) &&
            !isArrowFunctionExpression(unwrapped) &&
            this.hasCallExpression(unwrapped)
          ) {
            isAsync = isAwaitExpression(unwrapped);
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
    doc: vscode.TextDocument,
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
          const isFunctionLike =
            isFunctionExpression(unwrapped) || isArrowFunctionExpression(unwrapped);
          if (!isFunctionLike) {
            continue;
          }

          const bodyStart = getNodeStart(unwrapped.body);
          const bodyStartLine =
            bodyStart !== undefined ? doc.positionAt(bodyStart).line : declStartLine;

          if (
            isIdentifier(id) &&
            id.name === varName &&
            line >= declStartLine &&
            line <= bodyStartLine
          ) {
            found = true;
            return true;
          }
        }
      }
    });

    return found ? { type: CodeContextType.FunctionExpression } : null;
  }

  private matchesDeclaratorPattern(pattern: ASTNode, varName: string): boolean {
    if (isIdentifier(pattern) && pattern.name === varName) {
      return true;
    }

    if (pattern.type === "AssignmentPattern") {
      return this.matchesDeclaratorPattern(pattern.left, varName);
    }

    if (pattern.type === "RestElement") {
      return this.matchesDeclaratorPattern(pattern.argument, varName);
    }

    if (isObjectPattern(pattern)) {
      for (const prop of pattern.properties) {
        if (prop.type === "Property" && this.matchesDeclaratorPattern(prop.value, varName)) {
          return true;
        }

        if (prop.type === "RestElement" && this.matchesDeclaratorPattern(prop.argument, varName)) {
          return true;
        }
      }
    }

    if (isArrayPattern(pattern)) {
      for (const element of pattern.elements) {
        if (element && this.matchesDeclaratorPattern(element, varName)) {
          return true;
        }
      }
    }

    return false;
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

  private isParameterMatchOnLine(
    param: ASTNode,
    doc: vscode.TextDocument,
    line: number,
    varName: string
  ): boolean {
    const paramStart = getNodeStart(param);
    if (paramStart !== undefined) {
      const paramLine = doc.positionAt(paramStart).line;
      const paramEnd = getNodeEnd(param);
      const paramEndLine = paramEnd !== undefined ? doc.positionAt(paramEnd).line : paramLine;
      const effectiveEndLine = paramEndLine < paramLine ? paramLine : paramEndLine;

      if (line >= paramLine && line <= effectiveEndLine) {
        return true;
      }
    }

    let found = false;

    walk(param, (node: ASTNode): boolean | void => {
      if (!isIdentifier(node) || node.name !== varName) {
        return false;
      }

      const start = getNodeStart(node);
      if (start === undefined) {
        return false;
      }

      if (doc.positionAt(start).line === line) {
        found = true;
        return true;
      }

      return false;
    });

    return found;
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
          // 对于包含点号的变量名（如 OrderBy.updatedAt），只需要检查行是否在对象内部
          // 不需要检查变量是否在对象中，因为它可能是属性值而不是属性名
          if (varName.includes(".")) {
            found = true;
            parentObjectNode = node;
            return true;
          }

          // 对于简单变量名，检查对象内部是否包含目标变量
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
   * 优先返回最直接（最近）的包含关系
   */
  private findVariableNameForNode(tree: ASTNode, targetNode: ASTNode): string | null {
    let varName: string | null = null;
    let smallestDepth = Infinity; // 跟踪最小的嵌套深度

    walk(tree, (node: ASTNode): boolean | void => {
      // 查找变量声明
      if (isVariableDeclaration(node)) {
        for (const declarator of node.declarations) {
          // 检查是否是直接赋值（init === targetNode）
          if (declarator.init === targetNode) {
            if (isIdentifier(declarator.id)) {
              varName = declarator.id.name;
              return true; // 找到直接赋值，立即返回
            }
          }

          // 检查是否包含在 init 中
          if (declarator.init && this.nodeContains(declarator.init, targetNode)) {
            // 计算嵌套深度
            const depth = this.calculateNodeDepth(declarator.init, targetNode);

            if (depth < smallestDepth && isIdentifier(declarator.id)) {
              smallestDepth = depth;
              varName = declarator.id.name;
            }
          }
        }
      }

      // 查找赋值表达式
      if (node.type === "AssignmentExpression") {
        const left = node.left;
        const right = node.right;

        // 检查是否是直接赋值
        if (right === targetNode) {
          if (isIdentifier(left)) {
            varName = left.name;
            return true; // 找到直接赋值，立即返回
          }
        }

        // 检查是否包含在 right 中
        if (right && this.nodeContains(right, targetNode)) {
          const depth = this.calculateNodeDepth(right, targetNode);

          if (depth < smallestDepth && isIdentifier(left)) {
            smallestDepth = depth;
            varName = left.name;
          }
        }
      }
    });

    return varName;
  }

  /**
   * 计算从父节点到子节点的嵌套深度
   * 深度越小，说明关系越直接
   */
  private calculateNodeDepth(parent: ASTNode, child: ASTNode): number {
    if (parent === child) return 0;

    let minDepth = Infinity;

    const traverse = (node: any, depth: number): void => {
      if (node === child) {
        minDepth = Math.min(minDepth, depth);
        return;
      }

      if (!node || typeof node !== "object") return;

      // 跳过位置信息属性
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
