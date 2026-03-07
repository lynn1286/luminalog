import * as vscode from "vscode";
import { LogMessageService } from "../services/log-message-service";
import { getActiveEditor, getTabSize } from "../utils/editor-helper";
import { handleError } from "../utils/error-handler";
import { LogMessage } from "../types";

export function createCommentAllLogMessagesCommand(
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
      // 只注释未被注释的 console.log
      const logMessages = logMessageService.detectAllLogMessages(document, tabSize);

      await editor.edit(editBuilder => {
        logMessages.forEach((logMsg: LogMessage) => {
          const { lines } = logMsg;
          lines.forEach((line: vscode.Range) => {
            const lineText = document.getText(line);
            // 保留原有缩进，在非空白内容前添加 //
            const leadingSpaces = lineText.match(/^\s*/)?.[0] || "";
            const content = lineText.trimStart();
            editBuilder.delete(line);
            editBuilder.insert(line.start, `${leadingSpaces}// ${content}`);
          });
        });
      });
    } catch (error) {
      handleError(error as Error, "commentAllLogMessages");
    }
  };
}
