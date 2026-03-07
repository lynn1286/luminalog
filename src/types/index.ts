import * as vscode from "vscode";

export type JSBlockType = "class" | "function";

export interface LogMessage {
  spaces?: string;
  lines: vscode.Range[];
}

export interface ExtensionProperties {
  wrapLogMessage: boolean;
  logMessagePrefix: string;
  addSemicolonInTheEnd: boolean;
  insertEnclosingClass: boolean;
  insertEnclosingFunction: boolean;
  quote: string;
  makeLogColorful: boolean;
  logMessageFontSize: number;
}

// Re-export service types
export * from "./services";
