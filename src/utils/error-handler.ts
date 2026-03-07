import * as vscode from "vscode";

export function handleError(error: Error, context: string): void {
  const message = `Error in ${context}: ${error.message}`;
  console.error(message, error);
  vscode.window.showErrorMessage(message);
}

export function showErrorMessage(message: string): void {
  vscode.window.showErrorMessage(`Console Log with Emoji: ${message}`);
}

export function logError(error: Error, context: string): void {
  console.error(`[Console Log with Emoji] ${context}:`, error);
}
