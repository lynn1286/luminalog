import { describe, it, expect, beforeEach } from "vitest";
import { CodeAnalyzer } from "../../core/code-analyzer";
import * as vscode from "vscode";

describe("CodeAnalyzer - getContextNames", () => {
  let codeAnalyzer: CodeAnalyzer;

  beforeEach(() => {
    codeAnalyzer = new CodeAnalyzer();
  });

  it("should not include method context when variable is outside the method", () => {
    // 模拟 crossword-settings-drawer.tsx 的结构
    const lines = [
      "class CrosswordGenerator {",
      "  private canvas?: CrosswordCanvas;",
      "",
      "  async generate(words: string[]) {",
      "    return await new Promise<string>((resolve, reject) => {",
      "      // method body",
      "    });",
      "  }",
      "}",
      "export const crosswordGenerator = new CrosswordGenerator();",
      "",
      "export const LayerMoreSettings = ({ onClick }) => {",
      "  const t = useTranslations('designer');",
      "  console.log(t);", // 第 12 行 - 应该只显示 LayerMoreSettings
      "  return <div>...</div>;",
      "};",
    ];

    const document = createMockDocument(lines);

    // 在 LayerMoreSettings 组件内部（第 12 行）
    const contextNames = codeAnalyzer.getContextNames(document, 12);

    // 验证：应该只返回 LayerMoreSettings，不应该包含 generate
    expect(contextNames).toEqual(["LayerMoreSettings"]);
    expect(contextNames).not.toContain("generate");
  });

  it("should not include method context when arrow function is at top level after class", () => {
    // 更接近实际问题的测试用例
    // generate 方法缩进 2，LayerMoreSettings 缩进 0，console.log 缩进 2
    const lines = [
      "class CrosswordGenerator {",
      "  async generate(words: string[]) {", // 缩进 2
      "    return 'result';",
      "  }",
      "}",
      "",
      "export const LayerMoreSettings = ({ onClick }) => {", // 缩进 0
      "  const t = useTranslations();", // 缩进 2
      "  console.log(t);", // 第 8 行，缩进 2
      "  return null;",
      "};",
    ];

    const document = createMockDocument(lines);

    // 在 LayerMoreSettings 组件内部（第 8 行）
    const contextNames = codeAnalyzer.getContextNames(document, 8);

    // 验证：应该只返回 LayerMoreSettings，不应该包含 generate
    expect(contextNames).toEqual(["LayerMoreSettings"]);
    expect(contextNames).not.toContain("generate");
  });

  it("should reproduce the actual crossword-settings-drawer issue", () => {
    // 精确复现实际问题的测试用例
    const lines = [
      "class CrosswordGenerator {",
      "  private canvas?: CrosswordCanvas;",
      "  private element?: HTMLCanvasElement;",
      "",
      "  // 生成拼字游戏",
      "  async generate(words: CrosswordMaterial['words'], options: Omit<CrosswordMaterial, 'words'>) {",
      "    const { fontFamily, pattern, fontColor, showScore } = options;",
      "",
      "    return await new Promise<string>((resolve, reject) => {",
      "      if (!this.element) {",
      "        this.element = document.createElement('canvas');",
      "        this.canvas = new CrosswordCanvas(this.element, { env: ENV as Env });",
      "      }",
      "      this.canvas!.schedulerGenerate(",
      "        words.map((w) => w.toUpperCase()),",
      "        {",
      "          fontColor,",
      "          fontFamily: fontFamily as unknown as IFontFamily,",
      "          pattern: Oss.format(pattern, 'webp'),",
      "          showScore,",
      "        },",
      "        async () => {",
      "          const blob = ObjectURL.create(await this.canvas!.toBlob());",
      "          resolve(blob);",
      "        },",
      "        reject,",
      "      );",
      "    });",
      "  }",
      "}",
      "export const crosswordGenerator = new CrosswordGenerator();",
      "",
      "interface LayerMoreSettingsProps {",
      "  onClick?: () => void;",
      "  className?: string;",
      "}",
      "",
      "export const LayerMoreSettings: React.FC<LayerMoreSettingsProps> = ({ onClick, className }) => {",
      "  const t = useTranslations('designer');",
      "  console.log(t);", // 第 38 行
      "",
      "  return (",
      "    <div",
      "      className={classnames(",
      "        'cm-flex cm-cursor-pointer',",
      "        className,",
      "      )}",
      "      onClick={(e) => {",
      "        e.stopPropagation();",
      "        onClick?.();",
      "      }}",
      "    >",
      "      {t('more-settings')}",
      "    </div>",
      "  );",
      "};",
    ];

    const document = createMockDocument(lines);

    // 在 LayerMoreSettings 组件内部（第 38 行）
    const contextNames = codeAnalyzer.getContextNames(document, 38);

    // 验证：应该只返回 LayerMoreSettings，不应该包含 generate
    expect(contextNames).toEqual(["LayerMoreSettings"]);
    expect(contextNames).not.toContain("generate");
  });

  it("should correctly identify nested function context", () => {
    const lines = [
      "function outer() {",
      "  function inner() {",
      "    const x = 1;", // 第 2 行 - 应该显示 outer -> inner
      "  }",
      "}",
    ];

    const document = createMockDocument(lines);
    const contextNames = codeAnalyzer.getContextNames(document, 2);

    expect(contextNames).toEqual(["outer", "inner"]);
  });

  it("should handle destructuring assignment correctly", () => {
    // 测试解构赋值的情况
    const lines = [
      "const CrosswordSettingsDrawer = (props: IProps) => {",
      "  const { visible, onClose } = props;",
      "  const t = useTranslations('designer');", // 第 2 行
      "  return null;",
      "};",
    ];

    const document = createMockDocument(lines);
    const contextNames = codeAnalyzer.getContextNames(document, 2);

    // 验证：应该只返回 CrosswordSettingsDrawer
    expect(contextNames).toEqual(["CrosswordSettingsDrawer"]);
  });

  it("should not treat destructuring as function declaration", () => {
    // 精确复现实际问题：在解构赋值行附近
    const lines = [
      "export const LayerMoreSettings: React.FC<LayerMoreSettingsProps> = ({ onClick, className }) => {",
      "  const t = useTranslations('designer');",
      "  console.log(t);",
      "  return <div>...</div>;",
      "};",
      "",
      "const CrosswordSettingsDrawer = (props: IProps) => {",
      "  const { visible, onClose } = props;", // 第 7 行
      "  const t = useTranslations('designer');", // 第 8 行
      "  const ct = useTranslations('custom');",
      "  return null;",
      "};",
    ];

    const document = createMockDocument(lines);

    // 在第 8 行（CrosswordSettingsDrawer 内部）
    const contextNames = codeAnalyzer.getContextNames(document, 8);

    // 验证：应该只返回 CrosswordSettingsDrawer，不应该包含 onClose
    expect(contextNames).toEqual(["CrosswordSettingsDrawer"]);
    expect(contextNames).not.toContain("onClose");
  });

  it("should not treat interface method signature as function declaration", () => {
    // 测试接口中的函数类型属性不应该被识别为函数声明
    const lines = [
      "interface IProps {",
      "  visible: boolean;",
      "  onClose: () => void;", // 第 2 行 - 这不是函数声明
      "}",
      "",
      "export const LayerMoreSettings: React.FC<IProps> = ({ onClick }) => {",
      "  const t = useTranslations('designer');", // 第 6 行
      "  return null;",
      "};",
    ];

    const document = createMockDocument(lines);

    // 在第 6 行（LayerMoreSettings 内部）
    const contextNames = codeAnalyzer.getContextNames(document, 6);

    // 验证：应该只返回 LayerMoreSettings，不应该包含 onClose
    expect(contextNames).toEqual(["LayerMoreSettings"]);
    expect(contextNames).not.toContain("onClose");
  });

  it("should include context for typed multiline arrow function components", () => {
    const lines = [
      "export const StoreOperateDropdown: React.FC<StoreOperateDropdownProps> = ({",
      "  storeId,",
      "  platform,",
      "  isButtonPlugin = false,",
      "}) => {",
      "  const isProd = platform === StoreType.etsy;",
      "  console.log(isProd);",
      "  return null;",
      "};",
    ];

    const document = createMockDocument(lines);
    const contextNames = codeAnalyzer.getContextNames(document, 5);

    expect(contextNames).toEqual(["StoreOperateDropdown"]);
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
