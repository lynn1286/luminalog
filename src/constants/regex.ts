export const REGEX = {
  // 匹配类声明：class ClassName { ... }
  CLASS_DECLARATION: /class(\s+)[a-zA-Z]+(.*){/,

  // 匹配对象声明：const obj = { ... }
  OBJECT_DECLARATION: /(const|let|var)?(\s*)[a-zA-Z0-9]*(\s*)=(\s*){/,

  // 匹配数组声明：const arr = [ ... ]
  ARRAY_DECLARATION: /(const|let|var)?(\s*)[a-zA-Z0-9]*(\s*)=(\s*)\[/,

  // 匹配函数调用赋值：const result = func(...)
  FUNCTION_CALL: /(const|let|var)?(\s*)[a-zA-Z0-9]*(\s*)=(\s*).*\(.*/,

  // 匹配对象方法调用：const result = obj.method(...)
  OBJECT_FUNCTION_CALL: /(const|let|var)?(\s*)[a-zA-Z0-9]*(\s*)=(\s*).*[a-zA-Z0-9]*\./,

  // 匹配命名函数声明：function name() {} 或 name() {}
  NAMED_FUNCTION: /(function)?(\s*)[a-zA-Z]+(\s*)\(.*\):?(\s*)[a-zA-Z]*(\s*){/,

  // 匹配匿名函数：function() {}
  NON_NAMED_FUNCTION: /(function)(\s*)\(.*\)(\s*){/,

  // 匹配函数表达式：const name = function() {} 或 const name = () => {}
  FUNCTION_EXPRESSION: /[a-zA-Z]+(\s*)=(\s*)(function)?(\s*)[a-zA-Z]*(\s*)\(.*\)(\s*)(=>)?(\s*){/,

  // 匹配 JavaScript 内置控制语句：if, switch, while, for, catch
  JS_BUILT_IN: /(if|switch|while|for|catch)(\s*)\(.*\)(\s*){/,

  // 匹配所有 console.log 调用
  CONSOLE_LOG: /console\.log\(/,

  // 匹配左括号（全局）
  OPENED_PARENTHESIS: /\(/g,

  // 匹配右括号（全局）
  CLOSED_PARENTHESIS: /\)/g,

  // 匹配左花括号（全局）
  OPENED_BRACKET: /{/g,

  // 匹配右花括号（全局）
  CLOSED_BRACKET: /}/g,

  // 匹配左方括号（全局）
  OPENED_SQUARE: /\[/g,

  // 匹配右方括号（全局）
  CLOSED_SQUARE: /\]/g,

  // 匹配反引号（全局）
  BACKTICK: /`/g,
} as const;
