// Mock for VS Code API
export class Position {
  constructor(
    public line: number,
    public character: number
  ) {}
}

export class Range {
  public start: Position;
  public end: Position;

  constructor(start: Position, end: Position) {
    this.start = start;
    this.end = end;
  }
}

export class Selection {
  public anchor: Position;
  public active: Position;
  public start: Position;
  public end: Position;

  constructor(anchor: Position, active: Position) {
    this.anchor = anchor;
    this.active = active;

    // Calculate start and end
    if (
      anchor.line < active.line ||
      (anchor.line === active.line && anchor.character < active.character)
    ) {
      this.start = anchor;
      this.end = active;
    } else {
      this.start = active;
      this.end = anchor;
    }
  }
}

export interface TextLine {
  text: string;
  lineNumber: number;
  range: Range;
  rangeIncludingLineBreak: Range;
  firstNonWhitespaceCharacterIndex: number;
  isEmptyOrWhitespace: boolean;
}

export interface TextDocument {
  uri: { fsPath: string };
  lineCount: number;
  lineAt(line: number): TextLine;
  lineAt(position: Position): TextLine;
  getText(range?: Range): string;
  getWordRangeAtPosition(position: Position): Range | undefined;
  positionAt(offset: number): Position;
}

export const Uri = {
  file: (path: string) => ({ fsPath: path }),
};

export const workspace = {
  getConfiguration: (_section?: string) => ({
    get: <T>(_key: string, defaultValue?: T): T => {
      // 返回默认值或模拟值
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      return {} as T;
    },
  }),
};
