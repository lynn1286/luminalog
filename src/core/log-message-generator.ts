import { ColorStyle, ExtensionConfig } from "../types/services";

export interface GeneratorParams {
  selectedVar: string;
  classThatEncloses: string;
  funcThatEncloses: string;
  config: ExtensionConfig;
  colorStyle: ColorStyle;
  indentation: string;
  insertLine: number;
  totalLines: number;
}

export class LogMessageGenerator {
  public generate(params: GeneratorParams): string {
    const hasVariable = params.selectedVar.trim().length > 0;
    const message = hasVariable
      ? this.generateWithVariable(params)
      : this.generateContextOnly(params);

    if (params.config.wrapLogMessage) {
      return this.wrapMessage(message, params);
    }

    const newlinePrefix = params.insertLine === params.totalLines ? "\n" : "";
    return `${newlinePrefix}${params.indentation}${message}\n`;
  }

  private generateWithVariable(params: GeneratorParams): string {
    const { selectedVar, config, colorStyle } = params;
    const contextPath = this.buildContextPath(params);
    const semicolon = config.addSemicolonInTheEnd ? ";" : "";

    // 如果有 contextPath，在变量名前加上分隔符
    const separator = contextPath ? config.contextSeparator : "";

    return [
      "console.log(",
      `${config.quote}`,
      `${colorStyle.key}`,
      `${contextPath}`,
      `${separator}`,
      `${selectedVar}`,
      `${colorStyle.space}`,
      `${config.quote}, `,
      `${colorStyle.value}`,
      `${selectedVar}`,
      `)${semicolon}`,
    ].join("");
  }

  private generateContextOnly(params: GeneratorParams): string {
    const { config, colorStyle } = params;
    const contextPath = this.buildContextPath(params).replace(/ -> $/, "");

    // Check if there's meaningful context (function/class names), not just prefix
    const hasContext = params.classThatEncloses || params.funcThatEncloses;
    const displayText = hasContext ? contextPath : "🎯 Debug point";

    const semicolon = config.addSemicolonInTheEnd ? ";" : "";
    const styleValue = colorStyle.value ? ", " + colorStyle.value.slice(0, -2) : "";

    return [
      "console.log(",
      `${config.quote}`,
      `${colorStyle.key}`,
      `${displayText}`,
      `${colorStyle.space}`,
      `${config.quote}`,
      `${styleValue}`,
      `)${semicolon}`,
    ].join("");
  }

  private buildContextPath(params: GeneratorParams): string {
    const { config } = params;
    const parts: string[] = [];

    if (config.logMessagePrefix) {
      parts.push(`${config.logMessagePrefix}: `);
    }

    if (config.insertEnclosingClass && params.classThatEncloses) {
      parts.push(params.classThatEncloses);
    }

    if (config.insertEnclosingFunction && params.funcThatEncloses) {
      parts.push(params.funcThatEncloses);
    }

    // 使用自定义分隔符，但 prefix 后面不需要
    const hasPrefix = config.logMessagePrefix ? 1 : 0;
    if (parts.length > hasPrefix) {
      const prefix = hasPrefix ? parts[0] : "";
      const contextParts = parts.slice(hasPrefix);
      return prefix + contextParts.join(config.contextSeparator);
    }

    return parts.join("");
  }

  private wrapMessage(message: string, params: GeneratorParams): string {
    const { config, indentation, insertLine, totalLines } = params;
    const semicolon = config.addSemicolonInTheEnd ? ";" : "";
    const separator = "-".repeat(message.length - 16); // 16 = console.log("");
    const wrapLine = `console.log(${config.quote}${config.logMessagePrefix}: ${separator}${config.quote})${semicolon}`;
    const newlinePrefix = insertLine === totalLines ? "\n" : "";

    return `${newlinePrefix}${indentation}${wrapLine}\n${indentation}${message}\n${indentation}${wrapLine}\n`;
  }
}
