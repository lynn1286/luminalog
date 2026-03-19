import * as vscode from "vscode";
import {
  ILogMessageService,
  LogMessageParams,
  LogMessageResult,
  ContextOnlyLogParams,
} from "../types/services";
import { LogMessage } from "../types";
import { ColorService } from "./color-service";
import { ConfigService } from "./config-service";
import { CodeAnalyzer } from "../core/code-analyzer";
import { LogMessageGenerator, GeneratorParams } from "../core/log-message-generator";
import { REGEX } from "../constants/regex";

export class LogMessageService implements ILogMessageService {
  private colorService: ColorService;
  private configService: ConfigService;
  private codeAnalyzer: CodeAnalyzer;
  private generator: LogMessageGenerator;

  constructor(
    colorService: ColorService,
    configService: ConfigService,
    codeAnalyzer: CodeAnalyzer,
    generator: LogMessageGenerator
  ) {
    this.colorService = colorService;
    this.configService = configService;
    this.codeAnalyzer = codeAnalyzer;
    this.generator = generator;
  }

  public generateLogMessage(params: LogMessageParams): LogMessageResult {
    const config = this.configService.getConfig();
    const { document, selectedVar, lineOfSelectedVar, originalPropertyName } = params;

    // 使用原始属性名进行位置计算（如果提供），否则使用 selectedVar
    const varForPositionCalc = originalPropertyName || selectedVar;

    let insertLine = this.codeAnalyzer.calculateInsertLine(
      document,
      lineOfSelectedVar,
      varForPositionCalc
    );

    // 获取上下文类型，判断是否是类声明、函数声明或类型声明
    const contextType = this.codeAnalyzer.getContextType(
      document,
      lineOfSelectedVar,
      varForPositionCalc
    );

    if (contextType !== "FunctionParam") {
      insertLine = this.adjustInsertLineForMultilineStatement(
        document,
        lineOfSelectedVar,
        insertLine
      );
    }

    // 使用插入行的缩进，而不是选中行的缩进
    const indentation = this.calculateInsertLineIndentation(
      document,
      insertLine,
      lineOfSelectedVar
    );

    // 如果是以下类型的声明，不应该生成日志（因为这些都是无意义的）
    const meaninglessContextTypes = [
      "ClassDeclaration",
      "FunctionDeclaration",
      "TypeAliasDeclaration",
      "InterfaceDeclaration",
      "EnumDeclaration",
      "GenericTypeParameter",
      "TypeAnnotation",
      "InterfaceProperty",
      "EnumMember",
      "TypeAliasProperty",
      "TypeUtilityKeyword",
      "TypeReference",
    ];

    if (contextType && meaninglessContextTypes.includes(contextType)) {
      return {
        message: "",
        insertLine: lineOfSelectedVar,
      };
    }

    // 获取上下文名称（最外层 + 最近）
    const contextNames = this.codeAnalyzer.getContextNames(document, lineOfSelectedVar);

    const colorStyle = config.makeLogColorful
      ? this.colorService.formatColorStyle(
          this.colorService.generateRandomColor(),
          config.logMessageFontSize,
          config.quote
        )
      : { key: "", value: "", space: "" };

    const generatorParams: GeneratorParams = {
      selectedVar,
      contextNames,
      config,
      colorStyle,
      indentation,
      insertLine,
      totalLines: document.lineCount,
    };

    const message = this.generator.generate(generatorParams);

    return {
      message,
      insertLine,
    };
  }

  /**
   * 计算插入行的缩进
   * 如果插入行已经有内容，使用该行的缩进
   * 否则使用选中行的缩进
   */
  private calculateInsertLineIndentation(
    document: vscode.TextDocument,
    insertLine: number,
    selectedLine: number
  ): string {
    // 如果插入行超出文档范围，使用选中行的缩进
    if (insertLine >= document.lineCount) {
      const selectedLineText = document.lineAt(selectedLine).text;
      const leadingSpaces = selectedLineText.search(/\S/);
      return leadingSpaces === -1 ? "" : " ".repeat(leadingSpaces);
    }

    // 获取插入行的内容
    const insertLineText = document.lineAt(insertLine).text;

    // 如果插入行是空行或只有空白，查找前一行的缩进
    if (insertLineText.trim().length === 0) {
      // 向上查找最近的非空行
      for (let i = insertLine - 1; i >= 0; i--) {
        const lineText = document.lineAt(i).text;
        if (lineText.trim().length > 0) {
          const leadingSpaces = lineText.search(/\S/);
          return leadingSpaces === -1 ? "" : " ".repeat(leadingSpaces);
        }
      }
      // 如果找不到，使用选中行的缩进
      const selectedLineText = document.lineAt(selectedLine).text;
      const leadingSpaces = selectedLineText.search(/\S/);
      return leadingSpaces === -1 ? "" : " ".repeat(leadingSpaces);
    }

    // 使用插入行的缩进
    const leadingSpaces = insertLineText.search(/\S/);
    return leadingSpaces === -1 ? "" : " ".repeat(leadingSpaces);
  }

  /**
   * 当插入点仍然落在“当前行下一行”时，检查当前是否处于未结束的多行语句中。
   * 如果是，则把插入点提升到完整语句末尾，避免破坏链式调用或跨行表达式语法。
   */
  private adjustInsertLineForMultilineStatement(
    document: vscode.TextDocument,
    selectedLine: number,
    insertLine: number
  ): number {
    if (insertLine !== selectedLine + 1) {
      return insertLine;
    }

    const statementEndLine = this.findStatementEndLineBySyntax(document, selectedLine);
    if (statementEndLine !== null && statementEndLine > selectedLine) {
      return statementEndLine + 1;
    }

    return insertLine;
  }

  private findStatementEndLineBySyntax(
    document: vscode.TextDocument,
    startLine: number
  ): number | null {
    let parenCount = 0;
    let braceCount = 0;
    let bracketCount = 0;

    for (let line = startLine; line < document.lineCount; line++) {
      const text = document.lineAt(line).text;

      for (const char of text) {
        if (char === "(") parenCount++;
        if (char === ")") parenCount--;
        if (char === "{") braceCount++;
        if (char === "}") braceCount--;
        if (char === "[") bracketCount++;
        if (char === "]") bracketCount--;
      }

      const trimmed = text.trim();
      const balanced = parenCount === 0 && braceCount === 0 && bracketCount === 0;

      if (balanced && trimmed.endsWith(";")) {
        return line;
      }
    }

    return null;
  }

  public detectAllLogMessages(document: vscode.TextDocument, tabSize: number): LogMessage[] {
    const logMessages: LogMessage[] = [];
    const totalLines = document.lineCount;

    for (let i = 0; i < totalLines; i++) {
      const lineText = document.lineAt(i).text;

      // 检查是否包含 console.log
      if (REGEX.CONSOLE_LOG.test(lineText)) {
        // 排除被注释的 console.log
        // 检查 console.log 前面是否有 // 或 /* 注释
        const trimmedLine = lineText.trim();
        if (trimmedLine.startsWith("//") || trimmedLine.startsWith("/*")) {
          continue; // 跳过注释行
        }

        // 检查 console.log 是否在行内注释中
        const consoleLogIndex = lineText.indexOf("console.log");
        const lineCommentIndex = lineText.indexOf("//");
        if (lineCommentIndex !== -1 && lineCommentIndex < consoleLogIndex) {
          continue; // console.log 在 // 注释之后，跳过
        }

        const logMessage: LogMessage = {
          lines: [],
          spaces: this.codeAnalyzer.calculateIndentation(document, i, tabSize),
        };

        let openCount = 0;
        let closeCount = 0;

        for (let j = i; j < totalLines; j++) {
          logMessage.lines.push(document.lineAt(j).rangeIncludingLineBreak);
          const lineText = document.lineAt(j).text;

          openCount += (lineText.match(REGEX.OPENED_PARENTHESIS) || []).length;
          closeCount += (lineText.match(REGEX.CLOSED_PARENTHESIS) || []).length;

          if (openCount === closeCount) {
            break;
          }
        }

        logMessages.push(logMessage);
      }
    }

    return logMessages;
  }

  /**
   * 检测所有 console.log 消息（包括已注释的）
   * 用于注释/取消注释功能
   */
  public detectAllLogMessagesIncludingCommented(
    document: vscode.TextDocument,
    tabSize: number
  ): LogMessage[] {
    const logMessages: LogMessage[] = [];
    const totalLines = document.lineCount;

    for (let i = 0; i < totalLines; i++) {
      const lineText = document.lineAt(i).text;

      // 检查是否包含 console.log（包括注释的）
      if (REGEX.CONSOLE_LOG.test(lineText)) {
        const logMessage: LogMessage = {
          lines: [],
          spaces: this.codeAnalyzer.calculateIndentation(document, i, tabSize),
        };

        let openCount = 0;
        let closeCount = 0;

        for (let j = i; j < totalLines; j++) {
          logMessage.lines.push(document.lineAt(j).rangeIncludingLineBreak);
          const currentLineText = document.lineAt(j).text;

          // 移除行注释后再计算括号
          // 如果行包含 //，只计算 // 之前的括号（对于行内注释）
          // 如果行以 // 开头，需要移除 // 后再计算（对于被注释的代码）
          let textToCount = currentLineText;
          const commentIndex = currentLineText.indexOf("//");
          if (commentIndex !== -1) {
            // 如果是被注释的 console.log 行，移除注释符号
            const trimmed = currentLineText.trim();
            if (trimmed.startsWith("//")) {
              // 移除开头的 // 和空格
              textToCount = currentLineText.replace(/\/\/\s*/, "");
            } else {
              // 行内注释，只计算注释前的部分
              textToCount = currentLineText.substring(0, commentIndex);
            }
          }

          openCount += (textToCount.match(REGEX.OPENED_PARENTHESIS) || []).length;
          closeCount += (textToCount.match(REGEX.CLOSED_PARENTHESIS) || []).length;

          if (openCount === closeCount && openCount > 0) {
            break;
          }
        }

        logMessages.push(logMessage);
        // 跳过已处理的行
        i = i + logMessage.lines.length - 1;
      }
    }

    return logMessages;
  }

  public isValidBlankLocation(document: vscode.TextDocument, line: number): boolean {
    // Check if line is within document bounds
    if (line < 0 || line >= document.lineCount) {
      return false;
    }

    const lineText = document.lineAt(line).text;

    // Check if line is blank (only whitespace)
    if (/^\s*$/.test(lineText)) {
      return true;
    }

    // Check if line ends with semicolon (statement complete)
    if (/;\s*$/.test(lineText)) {
      return true;
    }

    return false;
  }

  public generateContextOnlyLogMessage(params: ContextOnlyLogParams): LogMessageResult {
    const config = this.configService.getConfig();
    const { document, lineOfCursor } = params;

    // Determine insert line: blank line = current, semicolon line = next
    const lineText = document.lineAt(lineOfCursor).text;
    const isBlankLine = /^\s*$/.test(lineText);
    const insertLine = isBlankLine ? lineOfCursor : lineOfCursor + 1;

    // Calculate indentation
    let indentation: string;
    if (isBlankLine) {
      // For blank lines, use the existing whitespace on that line
      const leadingSpaces = lineText.search(/\S/);
      indentation = leadingSpaces === -1 ? lineText : " ".repeat(leadingSpaces);
    } else {
      // For semicolon lines, use the cursor line's indentation
      const leadingSpaces = lineText.search(/\S/);
      indentation = leadingSpaces === -1 ? "" : " ".repeat(leadingSpaces);
    }

    // 获取上下文名称（最外层 + 最近）
    const contextNames = this.codeAnalyzer.getContextNames(document, lineOfCursor);

    // Get color style
    const colorStyle = config.makeLogColorful
      ? this.colorService.formatColorStyle(
          this.colorService.generateRandomColor(),
          config.logMessageFontSize,
          config.quote
        )
      : { key: "", value: "", space: "" };

    // Generate message using LogMessageGenerator with empty selectedVar
    const generatorParams: GeneratorParams = {
      selectedVar: "", // Empty for context-only
      contextNames,
      config,
      colorStyle,
      indentation,
      insertLine,
      totalLines: document.lineCount,
    };

    const message = this.generator.generate(generatorParams);

    return {
      message,
      insertLine,
    };
  }

  /**
   * 获取代码上下文类型
   * 用于判断是否需要进行变量扩展
   */
  public getContextType(
    document: vscode.TextDocument,
    line: number,
    varName: string
  ): string | null {
    return this.codeAnalyzer.getContextType(document, line, varName);
  }

  /**
   * 获取对象变量名
   * 当用户在对象字面量内部选中属性时，返回对象的变量名
   */
  public getObjectVariableName(
    document: vscode.TextDocument,
    line: number,
    propertyName: string
  ): string | null {
    return this.codeAnalyzer.getObjectVariableName(document, line, propertyName);
  }

  /**
   * 获取数组变量名
   * 当用户在数组字面量内部选中元素时，返回数组的变量名
   */
  public getArrayVariableName(
    document: vscode.TextDocument,
    line: number,
    elementName: string
  ): string | null {
    return this.codeAnalyzer.getArrayVariableName(document, line, elementName);
  }

  /**
   * 获取数组元素索引
   * 当用户在数组字面量内部选中元素时，返回该元素在数组中的索引
   */
  public getArrayElementIndex(
    document: vscode.TextDocument,
    line: number,
    elementName: string
  ): number {
    return this.codeAnalyzer.getArrayElementIndex(document, line, elementName);
  }
}
