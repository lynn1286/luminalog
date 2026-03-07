import { ColorStyle, ExtensionConfig } from "../types/services";

export interface GeneratorParams {
  selectedVar: string;
  contextNames: string[];
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

    // 只有当有实际的上下文名称时，才添加分隔符
    // 不能只检查 contextPath，因为可能只有 prefix（emoji）
    const hasContext = params.contextNames.length > 0;
    const separator = hasContext ? config.contextSeparator : "";

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

    // Check if there's meaningful context
    const hasContext = params.contextNames.length > 0;
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

    // 如果启用了上下文插入，添加上下文名称
    if (config.insertContext && params.contextNames.length > 0) {
      parts.push(...params.contextNames);
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
