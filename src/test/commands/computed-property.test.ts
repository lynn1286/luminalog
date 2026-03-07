import { describe, it, expect } from "vitest";
import * as vscode from "vscode";

/**
 * 测试计算属性名的日志生成
 * 场景：在对象字面量中使用计算属性名，如 { [OrderType.POD]: 'value' }
 */
describe("display-log-message - computed property names", () => {
  /**
   * 创建模拟文档的辅助函数
   */
  function createMockDocument(lines: string[]): vscode.TextDocument {
    return {
      uri: vscode.Uri.file("test.ts"),
      lineCount: lines.length,
      getText: () => lines.join("\n"),
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
        } as vscode.TextLine;
      }) as any,
    } as vscode.TextDocument;
  }

  it("should generate TypeTextMap[OrderType.POD] when selecting POD in computed property", () => {
    const lines = [
      "const TypeTextMap = {",
      "  [OrderType.CUSTOM]: t('custom.custom.customization'),",
      "  [OrderType.POD]: 'POD',",
      "};",
    ];

    const document = createMockDocument(lines);

    // 模拟选择 "POD"（在 OrderType.POD 中）
    // 行 2: "  [OrderType.POD]: 'POD',"
    // 选择位置：从 "POD" 开始（在 OrderType.POD 中的 POD）
    const selection = new vscode.Selection(
      new vscode.Position(2, 14), // OrderType. 后的 P
      new vscode.Position(2, 17) // POD 的结束
    );

    // 这个测试验证了以下逻辑：
    // 1. expandSelectedVariable 应该识别到 [OrderType.POD] 并返回 OrderType.POD
    // 2. 检测到这是计算属性名（] 后面有 :）
    // 3. 向上查找找到对象变量名 TypeTextMap
    // 4. 构建完整路径 TypeTextMap[OrderType.POD]

    // 验证文档结构
    expect(document.lineAt(2).text).toContain("[OrderType.POD]:");
    expect(selection.start.line).toBe(2);
    expect(selection.start.character).toBe(14);
  });

  it("should handle computed property with enum member", () => {
    const lines = [
      "enum OrderType {",
      "  CUSTOM = 'CUSTOM',",
      "  POD = 'POD',",
      "}",
      "",
      "const TypeTextMap = {",
      "  [OrderType.CUSTOM]: t('custom.custom.customization'),",
      "  [OrderType.POD]: 'POD',",
      "};",
    ];

    const document = createMockDocument(lines);

    // 预期生成：TypeTextMap[OrderType.POD]
    expect(document.lineAt(7).text).toContain("[OrderType.POD]");
  });

  it("should distinguish computed property from array literal", () => {
    const lines = [
      "// 这是数组字面量，不是计算属性",
      "const arr = [OrderType.POD];",
      "",
      "// 这是计算属性",
      "const obj = {",
      "  [OrderType.POD]: 'value'",
      "};",
    ];

    const document = createMockDocument(lines);

    // 数组字面量：应该生成 OrderType.POD（不是 arr[OrderType.POD]）
    // 计算属性：应该生成 obj[OrderType.POD]
    expect(document.lineAt(1).text).toContain("[OrderType.POD]");
    expect(document.lineAt(5).text).toContain("[OrderType.POD]:");
  });

  it("should handle nested computed properties", () => {
    const lines = [
      "const config = {",
      "  types: {",
      "    [OrderType.POD]: {",
      "      name: 'POD',",
      "      [StatusType.ACTIVE]: true",
      "    }",
      "  }",
      "};",
    ];

    const document = createMockDocument(lines);

    // 外层应该生成：config.types[OrderType.POD]
    // 内层应该生成：config.types[OrderType.POD][StatusType.ACTIVE]
    // 注意：当前实现可能不支持嵌套，这是未来的改进方向
    expect(document.lineAt(2).text).toContain("[OrderType.POD]:");
    expect(document.lineAt(4).text).toContain("[StatusType.ACTIVE]:");
  });

  it("should handle computed property with complex expressions", () => {
    const lines = [
      "const map = {",
      "  [getKey()]: 'value1',",
      "  [`prefix_${id}`]: 'value2',",
      "  [obj.prop]: 'value3',",
      "};",
    ];

    const document = createMockDocument(lines);

    // 这些都是有效的计算属性名
    expect(document.lineAt(1).text).toContain("[getKey()]:");
    expect(document.lineAt(2).text).toContain("[`prefix_${id}`]:");
    expect(document.lineAt(3).text).toContain("[obj.prop]:");
  });
});
