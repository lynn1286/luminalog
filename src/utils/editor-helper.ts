import * as vscode from "vscode";

export function getActiveEditor(): vscode.TextEditor | undefined {
  return vscode.window.activeTextEditor;
}

export function getTabSize(editor: vscode.TextEditor): number {
  return (editor.options.tabSize as number) || 2;
}

export async function insertText(
  editor: vscode.TextEditor,
  position: vscode.Position,
  text: string
): Promise<boolean> {
  return editor.edit(editBuilder => {
    editBuilder.insert(position, text);
  });
}

export async function deleteRange(
  editor: vscode.TextEditor,
  range: vscode.Range
): Promise<boolean> {
  return editor.edit(editBuilder => {
    editBuilder.delete(range);
  });
}

export async function replaceRange(
  editor: vscode.TextEditor,
  range: vscode.Range,
  text: string
): Promise<boolean> {
  return editor.edit(editBuilder => {
    editBuilder.delete(range);
    editBuilder.insert(range.start, text);
  });
}
