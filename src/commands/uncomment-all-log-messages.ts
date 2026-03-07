import * as vscode from "vscode";
import { LogMessageService } from "../services/log-message-service";
import { getActiveEditor, getTabSize } from "../utils/editor-helper";
import { handleError } from "../utils/error-handler";
import { LogMessage } from "../types";

export function createUncommentAllLogMessagesCommand(
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

      await editor.edit(editBuilder => {
        logMessages.forEach((logMsg: LogMessage) => {
          const { lines } = logMsg;
          lines.forEach((line: vscode.Range) => {
            const lineText = document.getText(line);
            // 保留原有缩进，只移除 // 注释符号
            const leadingSpaces = lineText.match(/^\s*/)?.[0] || "";
            const restOfLine = lineText.substring(leadingSpaces.length);
            // 移除 // 和后面的一个空格（如果有）
            const uncommentedContent = restOfLine.replace(/^\/\/\s?/, "");
            // 如果移除后的内容和原内容相同，说明这行本来就没有注释，跳过
            if (uncommentedContent === restOfLine) {
              return;
            }
            editBuilder.delete(line);
            editBuilder.insert(line.start, `${leadingSpaces}${uncommentedContent}`);
          });
        });
      });
    } catch (error) {
      handleError(error as Error, "uncommentAllLogMessages");
    }
  };
}
