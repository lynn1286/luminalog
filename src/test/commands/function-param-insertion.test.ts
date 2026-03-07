import { describe, it, expect, beforeEach } from "vitest";
import * as vscode from "vscode";
import { LogMessageService } from "../../services/log-message-service";
import { ColorService } from "../../services/color-service";
import { ConfigService } from "../../services/config-service";
import { CodeAnalyzer } from "../../core/code-analyzer";
import { LogMessageGenerator } from "../../core/log-message-generator";

describe("Function Parameter Console.log Insertion", () => {
  let logMessageService: LogMessageService;

  beforeEach(() => {
    const configService = new ConfigService();
    const colorService = new ColorService(configService);
    const codeAnalyzer = new CodeAnalyzer();
    const generator = new LogMessageGenerator();

    logMessageService = new LogMessageService(colorService, configService, codeAnalyzer, generator);
  });

  it("should allow console.log for function parameter in destructured param", () => {
    const code = `export default async function Page({ params }: { params: { handle: string } }) {
  const isSheinSide = isSheinMerchant();
}`;

    const document = {
      getText: () => code,
      lineAt: (line: number) => ({
        text: code.split("\n")[line],
        rangeIncludingLineBreak: {} as vscode.Range,
      }),
      lineCount: code.split("\n").length,
      positionAt: (offset: number) => {
        const lines = code.substring(0, offset).split("\n");
        return { line: lines.length - 1, character: lines[lines.length - 1].length };
      },
      uri: { fsPath: "test.tsx" },
    } as any as vscode.TextDocument;

    // 选中第一个 params（函数参数）
    const selectedVar = "params";
    const lineOfSelectedVar = 0; // 第一行

    const result = logMessageService.generateLogMessage({
      document,
      selectedVar,
      lineOfSelectedVar,
      tabSize: 2,
    });

    // 应该生成日志消息，而不是返回空字符串
    expect(result.message).not.toBe("");
    expect(result.message).toContain("console.log");
    expect(result.message).toContain("params");
  });

  it("should allow console.log for simple function parameter", () => {
    const code = `function simpleFunction(userId: string) {
  console.log(userId);
}`;

    const document = {
      getText: () => code,
      lineAt: (line: number) => ({
        text: code.split("\n")[line],
        rangeIncludingLineBreak: {} as vscode.Range,
      }),
      lineCount: code.split("\n").length,
      positionAt: (offset: number) => {
        const lines = code.substring(0, offset).split("\n");
        return { line: lines.length - 1, character: lines[lines.length - 1].length };
      },
      uri: { fsPath: "test.ts" },
    } as any as vscode.TextDocument;

    const selectedVar = "userId";
    const lineOfSelectedVar = 0;

    const result = logMessageService.generateLogMessage({
      document,
      selectedVar,
      lineOfSelectedVar,
      tabSize: 2,
    });

    expect(result.message).not.toBe("");
    expect(result.message).toContain("console.log");
    expect(result.message).toContain("userId");
  });

  it("should allow console.log for destructured parameter properties", () => {
    const code = `function multipleParams({ name, age }: { name: string; age: number }) {
  console.log(name, age);
}`;

    const document = {
      getText: () => code,
      lineAt: (line: number) => ({
        text: code.split("\n")[line],
        rangeIncludingLineBreak: {} as vscode.Range,
      }),
      lineCount: code.split("\n").length,
      positionAt: (offset: number) => {
        const lines = code.substring(0, offset).split("\n");
        return { line: lines.length - 1, character: lines[lines.length - 1].length };
      },
      uri: { fsPath: "test.ts" },
    } as any as vscode.TextDocument;

    // 测试 name 参数
    const result1 = logMessageService.generateLogMessage({
      document,
      selectedVar: "name",
      lineOfSelectedVar: 0,
      tabSize: 2,
    });

    expect(result1.message).not.toBe("");
    expect(result1.message).toContain("console.log");
    expect(result1.message).toContain("name");

    // 测试 age 参数
    const result2 = logMessageService.generateLogMessage({
      document,
      selectedVar: "age",
      lineOfSelectedVar: 0,
      tabSize: 2,
    });

    expect(result2.message).not.toBe("");
    expect(result2.message).toContain("console.log");
    expect(result2.message).toContain("age");
  });

  it("should NOT allow console.log for function name itself", () => {
    const code = `function myFunction(userId: string) {
  console.log(userId);
}`;

    const document = {
      getText: () => code,
      lineAt: (line: number) => ({
        text: code.split("\n")[line],
        rangeIncludingLineBreak: {} as vscode.Range,
      }),
      lineCount: code.split("\n").length,
      positionAt: (offset: number) => {
        const lines = code.substring(0, offset).split("\n");
        return { line: lines.length - 1, character: lines[lines.length - 1].length };
      },
      uri: { fsPath: "test.ts" },
    } as any as vscode.TextDocument;

    // 选中函数名本身
    const selectedVar = "myFunction";
    const lineOfSelectedVar = 0;

    const result = logMessageService.generateLogMessage({
      document,
      selectedVar,
      lineOfSelectedVar,
      tabSize: 2,
    });

    // 函数名本身应该被过滤
    expect(result.message).toBe("");
  });
});
