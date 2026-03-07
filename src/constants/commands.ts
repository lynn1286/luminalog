export const COMMANDS = {
  DISPLAY_LOG: "luminalog.displayLogMessage",
  COMMENT_ALL: "luminalog.commentAllLogMessages",
  UNCOMMENT_ALL: "luminalog.uncommentAllLogMessages",
  DELETE_ALL: "luminalog.deleteAllLogMessages",
} as const;

export type CommandName = (typeof COMMANDS)[keyof typeof COMMANDS];
