import * as vscode from "vscode";
import { IConfigService, ExtensionConfig } from "../types/services";
import {
  CONFIG_SECTION,
  CONFIG_KEYS,
  DEFAULT_VALUES,
  DEFAULT_EMOJIS,
  DEFAULT_COLORS,
} from "../constants/config";

export class ConfigService implements IConfigService {
  constructor() {}

  public getConfig(): ExtensionConfig {
    const workspaceConfig = vscode.workspace.getConfiguration(CONFIG_SECTION);

    const randomEmojiPrefix = workspaceConfig.get<boolean>(
      CONFIG_KEYS.RANDOM_EMOJI_PREFIX,
      DEFAULT_VALUES.RANDOM_EMOJI_PREFIX
    );

    const userPrefix = workspaceConfig.get<string>(
      CONFIG_KEYS.LOG_MESSAGE_PREFIX,
      DEFAULT_VALUES.LOG_MESSAGE_PREFIX
    );

    const logMessagePrefix = this.buildLogPrefix(userPrefix, randomEmojiPrefix);

    return {
      wrapLogMessage: workspaceConfig.get<boolean>(
        CONFIG_KEYS.WRAP_LOG_MESSAGE,
        DEFAULT_VALUES.WRAP_LOG_MESSAGE
      ),
      logMessagePrefix,
      randomEmojiPrefix,
      addSemicolonInTheEnd: workspaceConfig.get<boolean>(
        CONFIG_KEYS.ADD_SEMICOLON,
        DEFAULT_VALUES.ADD_SEMICOLON
      ),
      insertContext: workspaceConfig.get<boolean>(
        CONFIG_KEYS.INSERT_CONTEXT,
        DEFAULT_VALUES.INSERT_CONTEXT
      ),
      quote: workspaceConfig.get<string>(CONFIG_KEYS.QUOTE, DEFAULT_VALUES.QUOTE),
      makeLogColorful: workspaceConfig.get<boolean>(CONFIG_KEYS.COLORFUL, DEFAULT_VALUES.COLORFUL),
      logMessageFontSize: workspaceConfig.get<number>(
        CONFIG_KEYS.FONT_SIZE,
        DEFAULT_VALUES.FONT_SIZE
      ),
      contextSeparator: workspaceConfig.get<string>(
        CONFIG_KEYS.CONTEXT_SEPARATOR,
        DEFAULT_VALUES.CONTEXT_SEPARATOR
      ),
    };
  }

  private buildLogPrefix(userPrefix: string, includeEmoji: boolean): string {
    const parts: string[] = [];

    if (includeEmoji) {
      const emojis = this.getCustomEmojis();
      const randomIndex = Math.floor(Math.random() * emojis.length);
      const emoji = emojis[randomIndex];
      parts.push(emoji);
    }

    if (userPrefix) {
      parts.push(userPrefix);
    }

    return parts.join(" ");
  }

  public getCustomEmojis(): string[] {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const emojis = config.get<string[]>(CONFIG_KEYS.CUSTOM_EMOJIS, DEFAULT_EMOJIS);
    return emojis.length > 0 ? emojis : DEFAULT_EMOJIS;
  }

  public getCustomColors(): string[] {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const colors = config.get<string[]>(CONFIG_KEYS.CUSTOM_COLORS, DEFAULT_COLORS);
    return colors.length > 0 ? colors : DEFAULT_COLORS;
  }

  public watchConfig(callback: (config: ExtensionConfig) => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration(CONFIG_SECTION)) {
        callback(this.getConfig());
      }
    });
  }
}
