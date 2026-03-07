import * as vscode from "vscode";
import { LogMessageService } from "../services/log-message-service";
import { getActiveEditor, getTabSize } from "../utils/editor-helper";
import { handleError } from "../utils/error-handler";
import { LogMessage } from "../types";

export function createDeleteAllLogMessagesCommand(
  logMessageService: LogMessageService
): () => Promise<void> {
  return async () => {
    try {
      const editor = getActiveEditor();
      if (!editor) {
        return;
      }

      const tabSize = getTabSize(editor);
      const document = editor.document;
      const logMessages = logMessageService.detectAllLogMessagesIncludingCommented(
        document,
        tabSize
      );

      if (logMessages.length === 0) {
        vscode.window.showInformationMessage("No console.log statements found");
        return;
      }

      await editor.edit(editBuilder => {
        logMessages.forEach((logMsg: LogMessage) => {
          logMsg.lines.forEach((line: vscode.Range) => {
            editBuilder.delete(line);
          });
        });
      });

      vscode.window.showInformationMessage(
        `Deleted ${logMessages.length} console.log statement(s)`
      );
    } catch (error) {
      handleError(error as Error, "deleteAllLogMessages");
    }
  };
}
