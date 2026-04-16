import { describe, it, expect, beforeEach } from "vitest";
import * as vscode from "vscode";
import { CodeAnalyzer } from "../../core/code-analyzer";
import { LogMessageService } from "../../services/log-message-service";
import { ConfigService } from "../../services/config-service";
import { ColorService } from "../../services/color-service";
import { LogMessageGenerator } from "../../core/log-message-generator";

describe("display-log-message - multiline destructuring insertion", () => {
  let codeAnalyzer: CodeAnalyzer;
  let logMessageService: LogMessageService;

  beforeEach(() => {
    const configService = new ConfigService();
    const colorService = new ColorService(configService);
    codeAnalyzer = new CodeAnalyzer();
    const generator = new LogMessageGenerator();

    logMessageService = new LogMessageService(colorService, configService, codeAnalyzer, generator);
  });

  it("should insert after multiline destructuring declaration for destructured property", () => {
    const document = createMockDocument([
      "export default function Home(props: HomeProps) {",
      "  const {",
      "    infoResult,",
      "    customInfoData,",
      "    previewTemplates,",
      "    customInfoId,",
      "    info,",
      "    languageCode,",
      "    storeId,",
      "    from,",
      "  } = props;",
      "",
      "  const t = useTranslations('home');",
      "}",
    ]);

    const insertLine = codeAnalyzer.calculateInsertLine(document, 4, "previewTemplates");

    expect(insertLine).toBe(11);
  });

  it("should not drift into later function when selected variable is on destructuring closing line", () => {
    const document = createMockDocument([
      "export default function Home(props: HomeProps) {",
      "  const {",
      "    infoResult,",
      "    customInfoData,",
      "    previewTemplates,",
      "    customInfoId,",
      "    info,",
      "    languageCode,",
      "    storeId,",
      "    from,",
      "  } = props;",
      "",
      "  const t = useTranslations('home');",
      "",
      "  const handleOpenApiReference = () => {",
      "    window.open(`/${locale || 'en'}/api-reference`, '_blank');",
      "  };",
      "}",
    ]);

    const result = logMessageService.generateLogMessage({
      document,
      selectedVar: "props",
      lineOfSelectedVar: 10,
      tabSize: 2,
      originalPropertyName: "props",
    });

    expect(result.insertLine).toBe(11);
    expect(result.message).toContain("props");
  });

  it("should keep insertions inside arrow function component bodies", () => {
    const document = createMockDocument([
      "const PrintList = (props: Props) => {",
      "  const { list } = props;",
      "  const [dataSource, setDataSource] = useState(disposeTemplateData(list));",
      "  return dataSource;",
      "};",
    ]);

    const listResult = logMessageService.generateLogMessage({
      document,
      selectedVar: "list",
      lineOfSelectedVar: 1,
      tabSize: 2,
      originalPropertyName: "list",
    });

    const dataSourceResult = logMessageService.generateLogMessage({
      document,
      selectedVar: "dataSource",
      lineOfSelectedVar: 2,
      tabSize: 2,
      originalPropertyName: "dataSource",
    });

    expect(listResult.insertLine).toBe(2);
    expect(listResult.message).toContain("list");
    expect(dataSourceResult.insertLine).toBe(3);
    expect(dataSourceResult.message).toContain("dataSource");
  });
});

function createMockDocument(lines: string[]): vscode.TextDocument {
  return {
    uri: vscode.Uri.file("test.tsx"),
    lineCount: lines.length,
    lineAt: ((lineOrPosition: number | vscode.Position): vscode.TextLine => {
      const line = typeof lineOrPosition === "number" ? lineOrPosition : lineOrPosition.line;
      const text = lines[line];
      const trimmed = text.trim();
      return {
        text,
        lineNumber: line,
        range: new vscode.Range(
          new vscode.Position(line, 0),
          new vscode.Position(line, text.length)
        ),
        rangeIncludingLineBreak: new vscode.Range(
          new vscode.Position(line, 0),
          new vscode.Position(line, text.length + 1)
        ),
        firstNonWhitespaceCharacterIndex: text.length - text.trimStart().length,
        isEmptyOrWhitespace: trimmed.length === 0,
      };
    }) as any,
    getText: (range?: vscode.Range) => {
      if (!range) return lines.join("\n");

      if (range.start.line === range.end.line) {
        const line = lines[range.start.line];
        return line.substring(range.start.character, range.end.character);
      }

      return "";
    },
    getWordRangeAtPosition: () => undefined,
    positionAt: (offset: number): vscode.Position => {
      let currentOffset = 0;

      for (let i = 0; i < lines.length; i++) {
        const lineLength = lines[i].length + 1;
        if (currentOffset + lineLength > offset) {
          return new vscode.Position(i, offset - currentOffset);
        }
        currentOffset += lineLength;
      }

      return new vscode.Position(lines.length - 1, lines[lines.length - 1].length);
    },
  } as any as vscode.TextDocument;
}
