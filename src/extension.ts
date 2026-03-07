import * as vscode from "vscode";
import { COMMANDS } from "./constants/commands";
import { EmojiService } from "./services/emoji-service";
import { ColorService } from "./services/color-service";
import { ConfigService } from "./services/config-service";
import { LogMessageService } from "./services/log-message-service";
import { CodeAnalyzer } from "./core/code-analyzer";
import { LogMessageGenerator } from "./core/log-message-generator";
import { createDisplayLogMessageCommand } from "./commands/display-log-message";
import { createCommentAllLogMessagesCommand } from "./commands/comment-all-log-messages";
import { createUncommentAllLogMessagesCommand } from "./commands/uncomment-all-log-messages";
import { createDeleteAllLogMessagesCommand } from "./commands/delete-all-log-messages";

export function activate(context: vscode.ExtensionContext): void {
  // Initialize services
  const configService = new ConfigService();
  const emojiService = EmojiService.getInstance(configService);
  const colorService = new ColorService(configService);
  const codeAnalyzer = new CodeAnalyzer();
  const logMessageGenerator = new LogMessageGenerator();
  const logMessageService = new LogMessageService(
    colorService,
    configService,
    codeAnalyzer,
    logMessageGenerator
  );

  // Register commands
  const commands = [
    {
      name: COMMANDS.DISPLAY_LOG,
      handler: createDisplayLogMessageCommand(logMessageService),
    },
    {
      name: COMMANDS.COMMENT_ALL,
      handler: createCommentAllLogMessagesCommand(logMessageService),
    },
    {
      name: COMMANDS.UNCOMMENT_ALL,
      handler: createUncommentAllLogMessagesCommand(logMessageService),
    },
    {
      name: COMMANDS.DELETE_ALL,
      handler: createDeleteAllLogMessagesCommand(logMessageService),
    },
  ];

  commands.forEach(({ name, handler }) => {
    const disposable = vscode.commands.registerCommand(name, handler);
    context.subscriptions.push(disposable);
  });

  // Watch for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration("luminalog.customEmojis")) {
        const newEmojis = configService.getCustomEmojis();
        emojiService.updateEmojis(newEmojis);
      }

      if (e.affectsConfiguration("luminalog.customColors")) {
        const newColors = configService.getCustomColors();
        colorService.updateColors(newColors);
      }
    })
  );
}

export function deactivate(): void {
  // Cleanup if needed
}
