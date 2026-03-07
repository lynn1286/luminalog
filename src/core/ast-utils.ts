import * as acorn from "acorn";
import { tsPlugin } from "acorn-typescript";
import * as vscode from "vscode";

/**
 * AST 节点接口
 * 定义了 @typescript-eslint/typescript-estree 解析器返回的 AST 节点的基本结构
 */
export interface ASTNode {
  type: string;
  range?: [number, number]; // typescript-estree 使用 range 数组
  start?: number; // 兼容性：某些代码可能使用 start
  end?: number; // 兼容性：某些代码可能使用 end
  loc?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * AST 工具函数集合
 * 提供类型检查和 AST 遍历功能
 */

/**
 * 获取节点的开始位置
 * @param node - AST 节点
 * @returns 开始位置的字符偏移量
 */
export function getNodeStart(node: ASTNode): number | undefined {
  if (node.range) {
    return node.range[0];
  }
  return node.start;
}

/**
 * 获取节点的结束位置
 * @param node - AST 节点
 * @returns 结束位置的字符偏移量
 */
export function getNodeEnd(node: ASTNode): number | undefined {
  if (node.range) {
    return node.range[1];
  }
  return node.end;
}

/**
 * 获取节点在文档中的行号范围
 * @param node - AST 节点
 * @param document - VS Code 文档
 * @returns 包含 startLine 和 endLine 的对象，如果节点没有位置信息返回 null
 */
export function getNodeLineRange(
  node: ASTNode,
  document: vscode.TextDocument
): { startLine: number; endLine: number } | null {
  const start = getNodeStart(node);
  const end = getNodeEnd(node);

  if (start === undefined || end === undefined) {
    return null;
  }

  const startLine = document.positionAt(start).line;
  const endLine = document.positionAt(end).line;

  return { startLine, endLine };
}

/**
 * 遍历 AST 树
 * @param node - 要遍历的节点
 * @param callback - 对每个节点执行的回调函数，返回 true 停止遍历
 */
export function walk(node: ASTNode, callback: (node: ASTNode) => boolean | void): void {
  if (!node || typeof node !== "object") {
    return;
  }

  // 执行回调，如果返回 true 则停止遍历
  if (callback(node) === true) {
    return;
  }

  // 遍历所有子节点
  for (const key in node) {
    if (key === "loc" || key === "start" || key === "end" || key === "type") {
      continue;
    }

    const value = node[key];

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === "object") {
          walk(item, callback);
        }
      }
    } else if (value && typeof value === "object") {
      walk(value, callback);
    }
  }
}

// ============ 类型检查函数 ============

export function isIdentifier(node: ASTNode): boolean {
  return node.type === "Identifier";
}

export function isCallExpression(node: ASTNode): boolean {
  return node.type === "CallExpression";
}

export function isAwaitExpression(node: ASTNode): boolean {
  return node.type === "AwaitExpression";
}

export function isMemberExpression(node: ASTNode): boolean {
  return node.type === "MemberExpression";
}

export function isVariableDeclaration(node: ASTNode): boolean {
  return node.type === "VariableDeclaration";
}

export function isExpressionStatement(node: ASTNode): boolean {
  return node.type === "ExpressionStatement";
}

export function isAssignmentExpression(node: ASTNode): boolean {
  return node.type === "AssignmentExpression";
}

export function isObjectPattern(node: ASTNode): boolean {
  return node.type === "ObjectPattern";
}

export function isArrayPattern(node: ASTNode): boolean {
  return node.type === "ArrayPattern";
}

export function isLogicalExpression(node: ASTNode): boolean {
  return node.type === "LogicalExpression";
}

export function isTSAsExpression(node: ASTNode): boolean {
  return node.type === "TSAsExpression";
}

export function isTSTypeAssertion(node: ASTNode): boolean {
  return node.type === "TSTypeAssertion";
}

export function isParenthesizedExpression(node: ASTNode): boolean {
  return node.type === "ParenthesizedExpression";
}

export function isFunctionDeclaration(node: ASTNode): boolean {
  return node.type === "FunctionDeclaration";
}

export function isFunctionExpression(node: ASTNode): boolean {
  return node.type === "FunctionExpression";
}

export function isArrowFunctionExpression(node: ASTNode): boolean {
  return node.type === "ArrowFunctionExpression";
}

export function isMethodDefinition(node: ASTNode): boolean {
  return node.type === "MethodDefinition";
}

export function isBlockStatement(node: ASTNode): boolean {
  return node.type === "BlockStatement";
}

export function isReturnStatement(node: ASTNode): boolean {
  return node.type === "ReturnStatement";
}

export function isIfStatement(node: ASTNode): boolean {
  return node.type === "IfStatement";
}

export function isObjectExpression(node: ASTNode): boolean {
  return node.type === "ObjectExpression";
}

export function isArrayExpression(node: ASTNode): boolean {
  return node.type === "ArrayExpression";
}

export function isTemplateLiteral(node: ASTNode): boolean {
  return node.type === "TemplateLiteral";
}

export function isBinaryExpression(node: ASTNode): boolean {
  return node.type === "BinaryExpression";
}

export function isConditionalExpression(node: ASTNode): boolean {
  return node.type === "ConditionalExpression";
}

/**
 * 解析代码为 AST
 * @param code - 要解析的代码字符串
 * @param fileExtension - 文件扩展名（用于确定解析选项）
 * @returns AST 根节点或 null（解析失败时）
 */
export function parseCode(code: string, fileExtension: string = ".ts"): ASTNode | null {
  // 1. 检测文件类型
  const isJSX = fileExtension === ".jsx" || fileExtension === ".tsx";

  let codeToParse = code;
  let lineOffset = 0;
  let byteOffset = 0;

  // 2. 提取脚本内容（如果是特殊文件类型）
  if (fileExtension === ".vue") {
    const extracted = extractVueScript(code);
    codeToParse = extracted.code;
    lineOffset = extracted.lineOffset;
    byteOffset = extracted.byteOffset;
  } else if (fileExtension === ".svelte") {
    const extracted = extractSvelteScript(code);
    codeToParse = extracted.code;
    lineOffset = extracted.lineOffset;
    byteOffset = extracted.byteOffset;
  } else if (fileExtension === ".astro") {
    const extracted = extractAstroScript(code);
    codeToParse = extracted.code;
    lineOffset = extracted.lineOffset;
    byteOffset = extracted.byteOffset;
  } else if (fileExtension === ".html") {
    const extracted = extractHtmlScript(code);
    codeToParse = extracted.code;
    lineOffset = extracted.lineOffset;
    byteOffset = extracted.byteOffset;
  }

  // 如果提取后没有代码，返回 null
  if (!codeToParse || codeToParse.trim().length === 0) {
    return null;
  }

  // 3. 使用 Acorn 解析
  // 对于 JSX/TSX 文件，优先使用 module 模式（因为通常包含 import/export）
  // 对于其他文件，优先尝试 script 模式（允许顶层 return，用于测试代码片段）
  const parseStrategies = isJSX
    ? ["module", "script"] // JSX/TSX 优先 module
    : ["script", "module"]; // 其他文件优先 script

  for (const sourceType of parseStrategies) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parser = acorn.Parser.extend(tsPlugin() as any) as any;

      let ast = parser.parse(codeToParse, {
        ecmaVersion: "latest",
        sourceType: sourceType as "script" | "module",
        locations: true,
        allowReturnOutsideFunction: true,
      }) as ASTNode;

      // 调整 AST 位置信息（如果有偏移）
      if (lineOffset > 0 || byteOffset > 0) {
        ast = adjustASTLocations(ast, lineOffset, byteOffset);
      }

      return ast;
    } catch {
      // 继续尝试下一个策略
    }
  }

  // 所有策略都失败了，返回 null 让调用者回退到简单方法
  return null;
}

/**
 * 解包表达式，移除类型断言和括号
 * @param node - 要解包的节点
 * @returns 解包后的节点
 */
export function unwrapExpression(node: ASTNode): ASTNode {
  let current = node;

  // 持续解包直到找到实际的表达式
  while (
    current &&
    (isTSAsExpression(current) || isTSTypeAssertion(current) || isParenthesizedExpression(current))
  ) {
    current = current.expression;
  }

  return current;
}

/**
 * 脚本提取结果
 */
interface ScriptExtraction {
  code: string;
  lineOffset: number;
  byteOffset: number;
}

/**
 * 提取 Vue SFC 的 script 标签内容
 * 优先提取 <script setup>，其次 <script>
 */
function extractVueScript(code: string): ScriptExtraction {
  // 优先提取 <script setup>
  const setupMatch = code.match(/<script\s+setup[^>]*>([\s\S]*?)<\/script>/);
  const scriptMatch = code.match(/<script[^>]*>([\s\S]*?)<\/script>/);

  const match = setupMatch || scriptMatch;

  if (!match) {
    return { code: "", lineOffset: 0, byteOffset: 0 };
  }

  const scriptContent = match[1];
  const scriptStart = match.index! + match[0].indexOf(">") + 1;

  // 计算行偏移
  const beforeScript = code.substring(0, scriptStart);
  const lineOffset = (beforeScript.match(/\n/g) || []).length;

  return {
    code: scriptContent,
    lineOffset,
    byteOffset: scriptStart,
  };
}

/**
 * 提取 Svelte 的 script 标签内容
 */
function extractSvelteScript(code: string): ScriptExtraction {
  const match = code.match(/<script[^>]*>([\s\S]*?)<\/script>/);

  if (!match) {
    return { code: "", lineOffset: 0, byteOffset: 0 };
  }

  const scriptContent = match[1];
  const scriptStart = match.index! + match[0].indexOf(">") + 1;
  const beforeScript = code.substring(0, scriptStart);
  const lineOffset = (beforeScript.match(/\n/g) || []).length;

  return {
    code: scriptContent,
    lineOffset,
    byteOffset: scriptStart,
  };
}

/**
 * 提取 Astro 的 frontmatter 内容
 */
function extractAstroScript(code: string): ScriptExtraction {
  const match = code.match(/^---\n([\s\S]*?)\n---/);

  if (!match) {
    return { code: "", lineOffset: 0, byteOffset: 0 };
  }

  const scriptContent = match[1];
  const scriptStart = match.index! + 4; // '---\n' 的长度
  const lineOffset = 1; // frontmatter 从第二行开始

  return {
    code: scriptContent,
    lineOffset,
    byteOffset: scriptStart,
  };
}

/**
 * 提取 HTML 的第一个 script 标签内容
 */
function extractHtmlScript(code: string): ScriptExtraction {
  const match = code.match(/<script[^>]*>([\s\S]*?)<\/script>/);

  if (!match) {
    return { code: "", lineOffset: 0, byteOffset: 0 };
  }

  const scriptContent = match[1];
  const scriptStart = match.index! + match[0].indexOf(">") + 1;
  const beforeScript = code.substring(0, scriptStart);
  const lineOffset = (beforeScript.match(/\n/g) || []).length;

  return {
    code: scriptContent,
    lineOffset,
    byteOffset: scriptStart,
  };
}

/**
 * 调整 AST 节点的位置信息
 * 用于处理从特殊文件类型中提取的脚本
 */
function adjustASTLocations(ast: ASTNode, lineOffset: number, byteOffset: number): ASTNode {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function adjust(node: any): void {
    if (!node || typeof node !== "object") return;

    // 调整 loc 信息
    if (node.loc) {
      node.loc.start.line += lineOffset;
      node.loc.end.line += lineOffset;
    }

    // 调整 start/end 信息
    if (typeof node.start === "number") {
      node.start += byteOffset;
    }
    if (typeof node.end === "number") {
      node.end += byteOffset;
    }

    // 调整 range 信息（如果存在）
    if (Array.isArray(node.range)) {
      node.range[0] += byteOffset;
      node.range[1] += byteOffset;
    }

    // 递归处理子节点
    for (const key in node) {
      if (key === "loc" || key === "start" || key === "end" || key === "range") {
        continue;
      }

      const value = node[key];
      if (Array.isArray(value)) {
        value.forEach(adjust);
      } else if (value && typeof value === "object") {
        adjust(value);
      }
    }
  }

  adjust(ast);
  return ast;
}

/**
 * 检查节点是否包含另一个节点
 * @param parent - 父节点
 * @param child - 子节点
 * @returns 如果 parent 包含 child 返回 true
 */
export function containsNode(parent: ASTNode, child: ASTNode): boolean {
  if (!parent || !child) {
    return false;
  }

  if (parent === child) {
    return true;
  }

  let found = false;

  walk(parent, (node: ASTNode) => {
    if (node === child) {
      found = true;
      return true; // 停止遍历
    }
    return false; // 继续遍历
  });

  return found;
}
