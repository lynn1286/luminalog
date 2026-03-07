import * as vscode from "vscode";

// Base types
export type JSBlockType = "class" | "function";

export interface LogMessage {
  spaces?: string;
  lines: vscode.Range[];
}

// Emoji Service
export interface IEmojiService {
  getRandomEmoji(): string;
  getEmojiCount(): number;
  updateEmojis(emojis: string[]): void;
}

// Color Service
export interface ColorInfo {
  backgroundColor: string;
  textColor: string;
  luminance: number;
}

export interface ColorStyle {
  key: string;
  value: string;
  space: string;
}

export interface IColorService {
  generateRandomColor(): ColorInfo;
  formatColorStyle(color: ColorInfo, fontSize: number, quote: string): ColorStyle;
  updateColors(colors: string[]): void;
}

// Config Service
export interface ExtensionConfig {
  wrapLogMessage: boolean;
  logMessagePrefix: string;
  randomEmojiPrefix: boolean;
  addSemicolonInTheEnd: boolean;
  insertContext: boolean;
  quote: string;
  makeLogColorful: boolean;
  logMessageFontSize: number;
  contextSeparator: string;
}

export interface IConfigService {
  getConfig(): ExtensionConfig;
  watchConfig(callback: (config: ExtensionConfig) => void): vscode.Disposable;
  getCustomEmojis(): string[];
  getCustomColors(): string[];
}

// Log Message Service
export interface LogMessageParams {
  document: vscode.TextDocument;
  selectedVar: string;
  lineOfSelectedVar: number;
  tabSize: number;
  originalPropertyName?: string; // 原始属性名，用于位置计算（当 selectedVar 被扩展时）
}

export interface ContextOnlyLogParams {
  document: vscode.TextDocument;
  lineOfCursor: number;
  tabSize: number;
}

export interface LogMessageResult {
  message: string;
  insertLine: number;
}

export interface ILogMessageService {
  generateLogMessage(params: LogMessageParams): LogMessageResult;
  detectAllLogMessages(document: vscode.TextDocument, tabSize: number): LogMessage[];
  isValidBlankLocation(document: vscode.TextDocument, line: number): boolean;
  generateContextOnlyLogMessage(params: ContextOnlyLogParams): LogMessageResult;
  getContextType(document: vscode.TextDocument, line: number, varName: string): string | null;
  getObjectVariableName(
    document: vscode.TextDocument,
    line: number,
    propertyName: string
  ): string | null;
  getArrayVariableName(
    document: vscode.TextDocument,
    line: number,
    elementName: string
  ): string | null;
}

// Code Analyzer
export interface ICodeAnalyzer {
  isClassDeclaration(line: string): boolean;
  isObjectDeclaration(line: string): boolean;
  isFunctionDeclaration(line: string): boolean;
  isBuiltInStatement(line: string): boolean;
  extractClassName(line: string): string;
  extractFunctionName(line: string): string;
  findEnclosingBlock(document: vscode.TextDocument, line: number, blockType: JSBlockType): string;
  calculateInsertLine(
    document: vscode.TextDocument,
    selectionLine: number,
    selectedVar: string
  ): number;
  calculateIndentation(document: vscode.TextDocument, line: number, tabSize: number): string;
}
