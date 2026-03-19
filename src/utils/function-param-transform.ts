import * as path from "path";
import * as vscode from "vscode";
import {
  ASTNode,
  getNodeEnd,
  getNodeStart,
  isArrowFunctionExpression,
  parseCode,
  walk,
} from "../core/ast-utils";

export interface FunctionParamTransform {
  openRange: vscode.Range;
  openText: string;
  closeRange: vscode.Range;
  closeText: string;
}

/**
 * 为简写箭头函数生成语法安全的转换方案。
 * 例如：
 *   (prev) => ({ ...prev })
 *   (prev) => prev.progress === nextProgress ? prev : next
 * 会被转换为：
 *   (prev) => {
 *     console.log(prev);
 *     return ...;
 *   }
 */
export function buildFunctionParamTransform(
  document: vscode.TextDocument,
  targetLine: number,
  targetVariable: string,
  tabSize: number,
  logMessage: string
): FunctionParamTransform | null {
  const tree = parseCode(document.getText(), path.extname(document.uri.fsPath));
  if (!tree) {
    return null;
  }

  let targetArrow: ASTNode | null = null;
  let smallestRange = Infinity;

  walk(tree, (node: ASTNode): boolean | void => {
    if (!isArrowFunctionExpression(node) || !node.params || !node.body) {
      return false;
    }

    if (isBlockBody(node.body)) {
      return false;
    }

    for (const param of node.params) {
      const start = getNodeStart(param);
      if (start === undefined) {
        continue;
      }

      const end = getNodeEnd(param);
      const startLine = document.positionAt(start).line;
      const endLine = end !== undefined ? document.positionAt(end).line : startLine;

      if (targetLine < startLine || targetLine > endLine) {
        continue;
      }

      if (!matchesParameter(param, targetVariable)) {
        continue;
      }

      const nodeStart = getNodeStart(node);
      const nodeEnd = getNodeEnd(node);
      if (nodeStart === undefined || nodeEnd === undefined) {
        continue;
      }

      const rangeSize = nodeEnd - nodeStart;
      if (rangeSize < smallestRange) {
        smallestRange = rangeSize;
        targetArrow = node;
      }
    }

    return false;
  });

  const arrowNode = targetArrow as (ASTNode & { body?: ASTNode }) | null;

  if (!arrowNode?.body || isBlockBody(arrowNode.body)) {
    return null;
  }

  const boundaries = getBodyBoundaries(document, arrowNode, arrowNode.body);
  if (!boundaries) {
    return null;
  }

  const { openPosition, openEndPosition, closePosition } = boundaries;
  const outerIndent = getLeadingWhitespace(document.lineAt(openPosition.line).text);
  const innerIndent = getInnerIndent(
    document,
    openPosition.line,
    closePosition.line,
    outerIndent,
    tabSize
  );
  const normalizedMessage = logMessage.endsWith("\n") ? logMessage : `${logMessage}\n`;

  return {
    openRange: new vscode.Range(openPosition, openEndPosition),
    openText: ` {\n${normalizedMessage}${innerIndent}return `,
    closeRange: new vscode.Range(
      closePosition,
      getRangeEnd(closePosition, boundaries.replaceCloseToken)
    ),
    closeText: `;\n${outerIndent}}`,
  };
}

function isBlockBody(node: ASTNode): boolean {
  return node.type === "BlockStatement";
}

function getBodyBoundaries(
  document: vscode.TextDocument,
  arrowNode: ASTNode & { params?: ASTNode[] },
  body: ASTNode
): {
  openPosition: vscode.Position;
  openEndPosition: vscode.Position;
  closePosition: vscode.Position;
  replaceOpenToken: boolean;
  replaceCloseToken: boolean;
} | null {
  const source = document.getText();
  const bodyStart = getNodeStart(body);
  const bodyEnd = getNodeEnd(body);

  if (bodyStart === undefined || bodyEnd === undefined || bodyEnd <= bodyStart) {
    return null;
  }

  const arrowWhitespaceStart = getArrowWhitespaceStart(source, arrowNode, bodyStart);
  if (arrowWhitespaceStart === null) {
    return null;
  }

  if (source[bodyStart] === "(" && source[bodyEnd - 1] === ")") {
    return {
      openPosition: document.positionAt(arrowWhitespaceStart),
      openEndPosition: document.positionAt(bodyStart + 1),
      closePosition: document.positionAt(bodyEnd - 1),
      replaceOpenToken: false,
      replaceCloseToken: true,
    };
  }

  if (source[bodyStart - 1] === "(" && source[bodyEnd] === ")") {
    return {
      openPosition: document.positionAt(arrowWhitespaceStart),
      openEndPosition: document.positionAt(bodyStart),
      closePosition: document.positionAt(bodyEnd),
      replaceOpenToken: true,
      replaceCloseToken: true,
    };
  }

  return {
    openPosition: document.positionAt(arrowWhitespaceStart),
    openEndPosition: document.positionAt(bodyStart),
    closePosition: document.positionAt(bodyEnd),
    replaceOpenToken: false,
    replaceCloseToken: false,
  };
}

function getArrowWhitespaceStart(
  source: string,
  arrowNode: ASTNode & { params?: ASTNode[] },
  bodyStart: number
): number | null {
  const lastParam = arrowNode.params?.[arrowNode.params.length - 1];
  const searchStart = (lastParam ? getNodeEnd(lastParam) : undefined) ?? getNodeStart(arrowNode);

  if (searchStart === undefined || searchStart >= bodyStart) {
    return null;
  }

  const between = source.slice(searchStart, bodyStart);
  const arrowOffset = between.lastIndexOf("=>");

  if (arrowOffset === -1) {
    return null;
  }

  return searchStart + arrowOffset + 2;
}

function getRangeEnd(position: vscode.Position, replaceToken: boolean): vscode.Position {
  if (!replaceToken) {
    return position;
  }

  return new vscode.Position(position.line, position.character + 1);
}

function matchesParameter(param: ASTNode, varName: string): boolean {
  if (param.type === "Identifier") {
    return param.name === varName;
  }

  if (param.type === "AssignmentPattern") {
    return matchesParameter(param.left, varName);
  }

  if (param.type === "RestElement") {
    return matchesParameter(param.argument, varName);
  }

  if (param.type === "ObjectPattern") {
    for (const prop of param.properties) {
      if (prop.type === "Property" && matchesParameter(prop.value, varName)) {
        return true;
      }
      if (prop.type === "RestElement" && matchesParameter(prop.argument, varName)) {
        return true;
      }
    }
  }

  if (param.type === "ArrayPattern") {
    for (const element of param.elements) {
      if (element && matchesParameter(element, varName)) {
        return true;
      }
    }
  }

  return false;
}

function getLeadingWhitespace(line: string): string {
  const match = line.match(/^(\s*)/);
  return match ? match[1] : "";
}

function getInnerIndent(
  document: vscode.TextDocument,
  startLine: number,
  endLine: number,
  outerIndent: string,
  tabSize: number
): string {
  for (let line = startLine + 1; line <= endLine; line++) {
    const text = document.lineAt(line).text;
    if (text.trim().length === 0) {
      continue;
    }

    return getLeadingWhitespace(text);
  }

  return outerIndent + " ".repeat(tabSize);
}
