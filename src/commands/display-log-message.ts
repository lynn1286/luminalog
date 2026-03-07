import * as vscode from "vscode";
import { LogMessageService } from "../services/log-message-service";
import { getActiveEditor, getTabSize, insertText } from "../utils/editor-helper";
import { handleError } from "../utils/error-handler";

/**
 * 智能扩展选中的变量
 * 如果选中的是属性名（如 code），尝试扩展为完整的属性访问（如 res.code）
 * 支持多级属性访问（如 event.data.type）
 * 支持可选链操作符（如 cookies()?.value）
 */
function expandSelectedVariable(
  document: vscode.TextDocument,
  selection: vscode.Selection,
  selectedVar: string
): string {
  const line = document.lineAt(selection.active.line);
  const lineText = line.text;
  const selectionStart = selection.start.character;

  // 检查选中文本前面是否有 '.' 或 '?.'
  let hasDotBefore = false;
  let dotPosition = -1;

  if (selectionStart > 0 && lineText[selectionStart - 1] === ".") {
    hasDotBefore = true;
    dotPosition = selectionStart - 1;
  } else if (
    selectionStart > 1 &&
    lineText.substring(selectionStart - 2, selectionStart) === "?."
  ) {
    hasDotBefore = true;
    dotPosition = selectionStart - 2;
  }

  if (hasDotBefore) {
    // 检查是否是展开运算符 '...'
    // 如果前面有两个或更多的点，说明是展开运算符，不应该扩展
    if (
      dotPosition >= 2 &&
      lineText[dotPosition - 1] === "." &&
      lineText[dotPosition - 2] === "."
    ) {
      // 这是展开运算符（...），不扩展
      return selectedVar;
    }

    // 向前查找完整的属性访问链
    let objectStart = dotPosition - 1;

    // 持续向前查找，直到遇到非标识符字符
    while (objectStart >= 0) {
      const char = lineText[objectStart];

      // 允许的字符：字母、数字、下划线、$、点号（支持链式访问）、问号（可选链）
      // 还要支持方括号（数组访问）和括号（函数调用）、引号（字符串参数）
      if (!/[a-zA-Z0-9_$.?[\]'"]/.test(char)) {
        // 如果是右括号，需要找到匹配的左括号
        if (char === ")") {
          let parenCount = 1;
          objectStart--;
          while (objectStart >= 0 && parenCount > 0) {
            if (lineText[objectStart] === ")") parenCount++;
            if (lineText[objectStart] === "(") parenCount--;
            objectStart--;
          }
          continue;
        }
        break;
      }
      objectStart--;
    }
    objectStart++; // 回退到有效字符的开始位置

    // 提取完整的属性访问表达式
    const fullExpression = lineText.substring(objectStart, selection.end.character);

    // 验证表达式是否有效（至少包含一个点或可选链）
    if (
      (fullExpression.includes(".") || fullExpression.includes("?.")) &&
      fullExpression !== selectedVar
    ) {
      return fullExpression;
    }
  }

  return selectedVar;
}

export function createDisplayLogMessageCommand(
  logMessageService: LogMessageService
): () => Promise<void> {
  return async () => {
    try {
      const editor = getActiveEditor();
      if (!editor) {
        return;
      }

      const tabSize = getTabSize(editor);
      const document = editor.document;

      for (const selection of editor.selections) {
        // 获取选中的文本，如果没有选中则获取光标下的单词
        let selectedVar = document.getText(selection);
        let effectiveSelection = selection;

        // 如果没有选中文本，尝试获取光标位置的单词
        if (!selectedVar || selectedVar.trim().length === 0) {
          const wordRange = document.getWordRangeAtPosition(selection.active);
          if (wordRange) {
            selectedVar = document.getText(wordRange);
            // 创建一个新的 selection 对象，使用 wordRange 的范围
            effectiveSelection = new vscode.Selection(wordRange.start, wordRange.end);
          }
        }

        // 过滤 TypeScript 类型注解：检查选中的文本是否在类型注解位置
        if (selectedVar && selectedVar.trim().length > 0) {
          const line = document.lineAt(effectiveSelection.active.line);
          const lineText = line.text;
          const selectionStart = effectiveSelection.start.character;

          // 检查选中文本前是否有冒号（类型注解的标志）
          // 例如：{ params }: { params: { handle: string } }
          //                      ^^^^^^ 这部分是类型注解
          const textBeforeSelection = lineText.substring(0, selectionStart);
          const lastColonIndex = textBeforeSelection.lastIndexOf(":");

          if (lastColonIndex !== -1) {
            // 检查冒号和选中文本之间是否只有空格和花括号
            const betweenText = textBeforeSelection.substring(lastColonIndex + 1);
            if (/^\s*\{?\s*$/.test(betweenText)) {
              // 这是类型注解，跳过
              continue;
            }
          }
        }

        // 智能扩展选中的变量（处理属性访问）
        let originalPropertyName = selectedVar; // 保存原始属性名用于位置计算

        if (selectedVar && selectedVar.trim().length > 0) {
          // 第一步：先尝试常规的属性访问扩展（如 OrderBy.updatedAt）
          const expandedVar = expandSelectedVariable(document, effectiveSelection, selectedVar);

          // 检查是否在展开运算符中（...variable）
          const line = document.lineAt(effectiveSelection.active.line);
          const lineText = line.text;
          const selectionStart = effectiveSelection.start.character;
          const isInSpreadOperator =
            selectionStart >= 3 &&
            lineText[selectionStart - 1] === "." &&
            lineText[selectionStart - 2] === "." &&
            lineText[selectionStart - 3] === ".";

          // 如果扩展后的变量名包含点号，说明已经是完整的属性访问表达式
          // 或者在展开运算符中，都不需要再进行对象内部路径构建
          if (expandedVar.includes(".") || isInSpreadOperator) {
            selectedVar = expandedVar;
            originalPropertyName = expandedVar;
          } else {
            // 第二步：如果不是属性访问表达式且不在展开运算符中，检查是否在对象字面量内部
            const objectVarName = logMessageService.getObjectVariableName(
              document,
              effectiveSelection.active.line,
              selectedVar
            );

            if (objectVarName) {
              // 在对象内部，构建完整路径
              const arrayVarName = logMessageService.getArrayVariableName(
                document,
                effectiveSelection.active.line,
                selectedVar
              );

              if (arrayVarName && arrayVarName === objectVarName) {
                // 对象在数组内部，使用数组索引语法
                const arrayIndex = logMessageService.getArrayElementIndex(
                  document,
                  effectiveSelection.active.line,
                  selectedVar
                );
                selectedVar = `${objectVarName}[${arrayIndex}].${selectedVar}`;
              } else {
                // 普通对象属性
                selectedVar = `${objectVarName}.${selectedVar}`;
              }
            } else {
              // 不在对象内部，使用原始变量名或扩展后的变量名
              selectedVar = expandedVar;
              originalPropertyName = expandedVar;
            }
          }
        }

        // 检查是否在函数/方法/类声明行或函数调用行选中了名称本身
        // 这种情况不应该生成日志
        const currentLine = document.lineAt(effectiveSelection.active.line);
        const currentLineText = currentLine.text;

        // 检查当前行是否是函数声明
        const isFunctionDeclarationLine =
          /\bfunction\s+\w+\s*\(/.test(currentLineText) || // function name()
          /\w+\s*[=:]\s*(async\s+)?\(.*\)\s*(=>|:)/.test(currentLineText) || // arrow function
          /\w+\s*\(.*\)\s*\{/.test(currentLineText) || // method()
          /static\s+\w+\s*\(/.test(currentLineText); // static method()

        // 检查当前行是否是类声明
        const isClassDeclarationLine = /\bclass\s+\w+/.test(currentLineText);

        // 检查当前行是否是函数调用（函数名后面直接跟括号）
        const isFunctionCallLine = new RegExp(`\\b${selectedVar}\\s*\\(`).test(currentLineText);

        if (isFunctionDeclarationLine || isFunctionCallLine || isClassDeclarationLine) {
          // 提取函数名或类名
          let nameMatch = currentLineText.match(/\bfunction\s+(\w+)\s*\(/);
          if (!nameMatch) {
            nameMatch = currentLineText.match(/(\w+)\s*[=:]\s*(async\s+)?\(/);
          }
          if (!nameMatch) {
            nameMatch = currentLineText.match(/(?:static\s+)?(\w+)\s*\(/);
          }
          if (!nameMatch && isClassDeclarationLine) {
            nameMatch = currentLineText.match(/\bclass\s+(\w+)/);
          }
          // 对于函数调用，直接使用选中的变量名
          if (!nameMatch && isFunctionCallLine) {
            nameMatch = [selectedVar, selectedVar];
          }

          const name = nameMatch ? nameMatch[1] : null;

          // 如果选中的变量名与函数名/类名相同，跳过
          if (name && selectedVar === name) {
            continue;
          }
        }

        // 如果还是没有获取到变量名，跳过这个选区
        if (!selectedVar || selectedVar.trim().length === 0) {
          // Check if cursor is in a valid blank location
          const cursorLine = selection.active.line;
          if (!logMessageService.isValidBlankLocation(document, cursorLine)) {
            continue; // Not a valid location, skip
          }

          // Generate context-only log message
          const result = logMessageService.generateContextOnlyLogMessage({
            document,
            lineOfCursor: cursorLine,
            tabSize,
          });

          const insertPosition = new vscode.Position(
            result.insertLine >= document.lineCount ? document.lineCount : result.insertLine,
            0
          );

          await insertText(editor, insertPosition, result.message);
          continue;
        }

        const lineOfSelectedVar = effectiveSelection.active.line;

        const result = logMessageService.generateLogMessage({
          document,
          selectedVar,
          lineOfSelectedVar,
          tabSize,
          originalPropertyName, // 传递原始属性名用于位置计算
        });

        // 如果返回空消息，说明不应该生成日志（例如在类声明行）
        if (!result.message || result.message.trim().length === 0) {
          continue;
        }

        const insertPosition = new vscode.Position(
          result.insertLine >= document.lineCount ? document.lineCount : result.insertLine,
          0
        );

        await insertText(editor, insertPosition, result.message);
      }
    } catch (error) {
      handleError(error as Error, "displayLogMessage");
    }
  };
}
