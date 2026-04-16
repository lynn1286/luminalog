import { describe, it, expect, beforeEach } from "vitest";
import { LogMessageService } from "../../services/log-message-service";
import { ConfigService } from "../../services/config-service";
import { ColorService } from "../../services/color-service";
import { CodeAnalyzer } from "../../core/code-analyzer";
import { LogMessageGenerator } from "../../core/log-message-generator";
import * as vscode from "vscode";

describe("display-log-message - meaningless insertions", () => {
  let logMessageService: LogMessageService;

  beforeEach(() => {
    const configService = new ConfigService();
    const colorService = new ColorService(configService);
    const codeAnalyzer = new CodeAnalyzer();
    const generator = new LogMessageGenerator();

    logMessageService = new LogMessageService(colorService, configService, codeAnalyzer, generator);
  });

  it("should not generate log for type alias declaration", () => {
    const lines = [
      "type UserRole = 'admin' | 'user' | 'guest';",
      "",
      "function checkRole(role: UserRole) {",
      "  return role === 'admin';",
      "}",
    ];

    const document = createMockDocument(lines);

    // 在 type 声明行选中 UserRole
    const result = logMessageService.generateLogMessage({
      document,
      selectedVar: "UserRole",
      lineOfSelectedVar: 0,
      tabSize: 2,
    });

    // 验证：不应该生成日志
    expect(result.message).toBe("");
  });

  it("should not generate log for interface declaration", () => {
    const lines = ["interface IProps {", "  visible: boolean;", "  onClose: () => void;", "}"];

    const document = createMockDocument(lines);

    // 在 interface 声明行选中 IProps
    const result = logMessageService.generateLogMessage({
      document,
      selectedVar: "IProps",
      lineOfSelectedVar: 0,
      tabSize: 2,
    });

    // 验证：不应该生成日志
    expect(result.message).toBe("");
  });

  it("should not generate log for enum declaration", () => {
    const lines = ["enum Status {", "  Active = 'active',", "  Inactive = 'inactive',", "}"];

    const document = createMockDocument(lines);

    // 在 enum 声明行选中 Status
    const result = logMessageService.generateLogMessage({
      document,
      selectedVar: "Status",
      lineOfSelectedVar: 0,
      tabSize: 2,
    });

    // 验证：不应该生成日志
    expect(result.message).toBe("");
  });

  it("should not generate log for generic type parameters", () => {
    const lines = [
      "export const LayerMoreSettings: React.FC<LayerMoreSettingsProps> = ({ onClick }) => {",
      "  return null;",
      "};",
    ];

    const document = createMockDocument(lines);

    // 在第 0 行选中泛型参数 LayerMoreSettingsProps
    const result = logMessageService.generateLogMessage({
      document,
      selectedVar: "LayerMoreSettingsProps",
      lineOfSelectedVar: 0,
      tabSize: 2,
    });

    // 验证：不应该生成日志（因为这是类型参数，不是变量）
    expect(result.message).toBe("");
  });

  it("should not generate log for function expression declaration name in TSX component", () => {
    const lines = [
      "interface Props {",
      "  list: string[];",
      "}",
      "",
      "const PrintList = (props: Props) => {",
      "  const { list } = props;",
      "  return list;",
      "};",
    ];

    const document = createMockDocument(lines);

    // 在组件声明行选中函数表达式变量名 PrintList
    const result = logMessageService.generateLogMessage({
      document,
      selectedVar: "PrintList",
      lineOfSelectedVar: 4,
      tabSize: 2,
    });

    // 验证：不应该在组件外生成无意义日志
    expect(result.message).toBe("");
  });

  it("should not generate log for type annotation", () => {
    const lines = ["function greet(name: string) {", "  console.log('Hello', name);", "}"];

    const document = createMockDocument(lines);

    // 在第 0 行选中类型注解 string
    const result = logMessageService.generateLogMessage({
      document,
      selectedVar: "string",
      lineOfSelectedVar: 0,
      tabSize: 2,
    });

    // 验证：不应该生成日志
    expect(result.message).toBe("");
  });

  it("should not generate log for interface property", () => {
    // 测试接口内部的属性不应该生成日志
    const lines = [
      "interface LayerMoreSettingsProps {",
      "  onClick?: () => void;",
      "  className?: string;", // 第 2 行 - 接口属性
      "}",
      "",
      "export const Component = (props: LayerMoreSettingsProps) => {",
      "  return null;",
      "};",
    ];

    const document = createMockDocument(lines);

    // 在接口属性行选中 className
    const result = logMessageService.generateLogMessage({
      document,
      selectedVar: "className",
      lineOfSelectedVar: 2,
      tabSize: 2,
    });

    // 验证：不应该生成日志（因为这是接口属性定义，不是变量）
    expect(result.message).toBe("");
  });

  it("should not generate log for enum member", () => {
    // 测试枚举成员不应该生成日志
    const lines = [
      "enum Status {",
      "  Active = 'active',", // 第 1 行 - 枚举成员
      "  Inactive = 'inactive',",
      "}",
    ];

    const document = createMockDocument(lines);

    // 在枚举成员行选中 Active
    const result = logMessageService.generateLogMessage({
      document,
      selectedVar: "Active",
      lineOfSelectedVar: 1,
      tabSize: 2,
    });

    // 验证：不应该生成日志
    expect(result.message).toBe("");
  });

  it("should not generate log for type alias property", () => {
    // 测试 type 内部的属性不应该生成日志
    const lines = [
      "type UserInfo = {",
      "  name: string;", // 第 1 行 - type 属性
      "  age: number;",
      "};",
    ];

    const document = createMockDocument(lines);

    // 在 type 属性行选中 name
    const result = logMessageService.generateLogMessage({
      document,
      selectedVar: "name",
      lineOfSelectedVar: 1,
      tabSize: 2,
    });

    // 验证：不应该生成日志
    expect(result.message).toBe("");
  });

  it("should not generate log for complex type alias with Pick and intersection", () => {
    // 测试复杂类型别名：Pick + 交叉类型
    const lines = [
      "export type TFontListRequest = Pick<ICommonParams, 'page' | 'pageSize'> & {",
      "  keyword?: string;", // 第 1 行 - type 内部属性
      "  uploadType: number;",
      "};",
    ];

    const document = createMockDocument(lines);

    // 在 type 内部属性行选中 keyword
    const result = logMessageService.generateLogMessage({
      document,
      selectedVar: "keyword",
      lineOfSelectedVar: 1,
      tabSize: 2,
    });

    // 验证：不应该生成日志
    expect(result.message).toBe("");
  });

  it("should not generate log for type utility like Pick", () => {
    // 测试类型工具（Pick, Omit, Partial 等）不应该生成日志
    const lines = [
      "export type TFontListRequest = Pick<ICommonParams, 'page' | 'pageSize'> & {",
      "  keyword?: string;",
      "};",
    ];

    const document = createMockDocument(lines);

    // 在第 0 行选中 Pick
    const result = logMessageService.generateLogMessage({
      document,
      selectedVar: "Pick",
      lineOfSelectedVar: 0,
      tabSize: 2,
    });

    // 验证：不应该生成日志（Pick 是类型工具，不是变量）
    expect(result.message).toBe("");
  });

  it("should not generate log for type reference in generic parameter", () => {
    // 测试泛型参数中的类型引用不应该生成日志
    const lines = [
      "export type TFontListRequest = Pick<ICommonParams, 'page' | 'pageSize'> & {",
      "  keyword?: string;",
      "  uploadType: number;",
      "};",
    ];

    const document = createMockDocument(lines);

    // 在第 0 行选中泛型参数中的类型 ICommonParams
    const result = logMessageService.generateLogMessage({
      document,
      selectedVar: "ICommonParams",
      lineOfSelectedVar: 0,
      tabSize: 2,
    });

    // 验证：不应该生成日志（ICommonParams 是类型引用，不是变量）
    expect(result.message).toBe("");
  });

  it("should not generate log for generic type reference in type alias", () => {
    // 测试 type 声明右侧的泛型类型引用不应该生成日志
    const lines = [
      "export type TArticleListResponse = ICommonPageList<IArticleItem>;",
      "export interface IArticleItem {",
      "  id: number;",
      "}",
    ];

    const document = createMockDocument(lines);

    // 在第 0 行选中泛型类型 ICommonPageList
    const result = logMessageService.generateLogMessage({
      document,
      selectedVar: "ICommonPageList",
      lineOfSelectedVar: 0,
      tabSize: 2,
    });

    // 验证：不应该生成日志（ICommonPageList 是类型引用，不是变量）
    expect(result.message).toBe("");
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
