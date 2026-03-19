import { describe, it, expect, beforeEach } from "vitest";
import { LogMessageService } from "../../services/log-message-service";
import { ConfigService } from "../../services/config-service";
import { ColorService } from "../../services/color-service";
import { CodeAnalyzer } from "../../core/code-analyzer";
import { LogMessageGenerator } from "../../core/log-message-generator";
import * as vscode from "vscode";

describe("display-log-message - class declaration detection", () => {
  let logMessageService: LogMessageService;

  beforeEach(() => {
    const configService = new ConfigService();
    const colorService = new ColorService(configService);
    const codeAnalyzer = new CodeAnalyzer();
    const generator = new LogMessageGenerator();

    logMessageService = new LogMessageService(colorService, configService, codeAnalyzer, generator);
  });

  it("should not generate log for class name on class declaration line", () => {
    // 创建一个包含类声明的文档
    const lines = [
      "export class PageUpdateUtils {",
      "  constructor() {",
      "    // code",
      "  }",
      "}",
    ];

    const document = {
      uri: vscode.Uri.file("test.ts"),
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
      getWordRangeAtPosition: (position: vscode.Position) => {
        const line = lines[position.line];
        // 简单实现：查找 PageUpdateUtils
        const match = line.match(/\b(PageUpdateUtils)\b/);
        if (match && match.index !== undefined) {
          return new vscode.Range(
            new vscode.Position(position.line, match.index),
            new vscode.Position(position.line, match.index + match[1].length)
          );
        }
        return undefined;
      },
      positionAt: (offset: number): vscode.Position => {
        // 简单实现：计算偏移量对应的行和字符位置
        let currentOffset = 0;
        for (let i = 0; i < lines.length; i++) {
          const lineLength = lines[i].length + 1; // +1 for newline
          if (currentOffset + lineLength > offset) {
            return new vscode.Position(i, offset - currentOffset);
          }
          currentOffset += lineLength;
        }
        return new vscode.Position(lines.length - 1, lines[lines.length - 1].length);
      },
    } as vscode.TextDocument;

    // 在类声明行（第 0 行）选中类名 "PageUpdateUtils"
    const selectedVar = "PageUpdateUtils";
    const lineOfSelectedVar = 0;

    // 获取上下文类型
    const contextType = logMessageService.getContextType(document, lineOfSelectedVar, selectedVar);

    // 验证：应该识别为类声明
    expect(contextType).toBe("ClassDeclaration");

    // 尝试生成日志消息
    const result = logMessageService.generateLogMessage({
      document,
      selectedVar,
      lineOfSelectedVar,
      tabSize: 2,
    });

    // 验证：不应该生成包含变量的日志
    // 当前的实现会生成日志，但这是错误的行为
    // 这个测试应该失败，证明我们需要修复
    expect(result.message).not.toContain("PageUpdateUtils");
  });

  it("should not generate log for function name on function declaration line", () => {
    // 创建一个包含函数声明的文档
    const lines = [
      "export function calculateTotal(items: Item[]) {",
      "  return items.reduce((sum, item) => sum + item.price, 0);",
      "}",
    ];

    const document = {
      uri: vscode.Uri.file("test.ts"),
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
      getWordRangeAtPosition: (position: vscode.Position) => {
        const line = lines[position.line];
        // 简单实现：查找 calculateTotal
        const match = line.match(/\b(calculateTotal)\b/);
        if (match && match.index !== undefined) {
          return new vscode.Range(
            new vscode.Position(position.line, match.index),
            new vscode.Position(position.line, match.index + match[1].length)
          );
        }
        return undefined;
      },
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
    } as vscode.TextDocument;

    // 在函数声明行（第 0 行）选中函数名 "calculateTotal"
    const selectedVar = "calculateTotal";
    const lineOfSelectedVar = 0;

    // 尝试生成日志消息
    const result = logMessageService.generateLogMessage({
      document,
      selectedVar,
      lineOfSelectedVar,
      tabSize: 2,
    });

    // 验证：不应该生成包含函数名的日志
    // 注意：函数声明可能不会被识别为 FunctionDeclaration 上下文类型
    // 但我们仍然希望在函数声明行不生成无意义的日志
    expect(result.message).not.toContain("calculateTotal");
  });

  it("should insert before if statement when selecting member expression in condition", () => {
    const lines = [
      "Object.keys(pathMap).forEach((key) => {",
      "  let rowData = pathMap[key];",
      "  if (key === CUSTOM_LINK_TEMPLATE_KEY.CUSTOM_LINK) {",
      "    rowData = `<span>${pathMap[key]}</span>`;",
      "  }",
      "  result = result.replaceAll(key, rowData);",
      "});",
    ];

    const document = {
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
    } as vscode.TextDocument;

    const result = logMessageService.generateLogMessage({
      document,
      selectedVar: "CUSTOM_LINK_TEMPLATE_KEY.CUSTOM_LINK",
      lineOfSelectedVar: 2,
      tabSize: 2,
      originalPropertyName: "CUSTOM_LINK_TEMPLATE_KEY.CUSTOM_LINK",
    });

    expect(result.insertLine).toBe(2);
    expect(result.message).toContain("CUSTOM_LINK_TEMPLATE_KEY.CUSTOM_LINK");
  });
});
