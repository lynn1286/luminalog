export const CONFIG_SECTION = "luminalog";

export const CONFIG_KEYS = {
  WRAP_LOG_MESSAGE: "wrapLogMessage",
  LOG_MESSAGE_PREFIX: "logMessagePrefix",
  RANDOM_EMOJI_PREFIX: "randomEmojiPrefix",
  ADD_SEMICOLON: "addSemicolonInTheEnd",
  INSERT_CONTEXT: "insertContext",
  QUOTE: "quote",
  COLORFUL: "makeLogColorful",
  FONT_SIZE: "logMessageFontSize",
  CONTEXT_SEPARATOR: "contextSeparator",
  CUSTOM_EMOJIS: "customEmojis",
  CUSTOM_COLORS: "customColors",
} as const;

export const DEFAULT_VALUES = {
  WRAP_LOG_MESSAGE: false,
  LOG_MESSAGE_PREFIX: "",
  RANDOM_EMOJI_PREFIX: true,
  ADD_SEMICOLON: false,
  INSERT_CONTEXT: true,
  QUOTE: '"',
  COLORFUL: true,
  FONT_SIZE: 16,
  CONTEXT_SEPARATOR: " -> ",
} as const;

export type ConfigKey = (typeof CONFIG_KEYS)[keyof typeof CONFIG_KEYS];
export type DefaultValue = (typeof DEFAULT_VALUES)[keyof typeof DEFAULT_VALUES];

export const DEFAULT_EMOJIS = ["🔍", "🎯", "🚀", "💡", "⚡", "🎨", "🔥", "✨", "🎉", "🌟"];

export const DEFAULT_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#FFA07A",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E2",
  "#F8B739",
  "#52B788",
];
