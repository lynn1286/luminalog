/**
 * 代码上下文类型枚举
 * 定义了所有可能的代码场景，用于确定 console.log 的插入策略
 */
export enum CodeContextType {
  /** 函数参数定义 */
  FunctionParam = "FunctionParam",

  /** 函数调用返回值 */
  FunctionCallResult = "FunctionCallResult",

  /** 对象方法调用返回值 */
  ObjectMethodCallResult = "ObjectMethodCallResult",

  /** 独立的方法调用（无赋值） */
  StandaloneMethodCall = "StandaloneMethodCall",

  /** return 语句中的表达式 */
  ReturnExpression = "ReturnExpression",

  /** 条件语句中的表达式 */
  ConditionalExpression = "ConditionalExpression",

  /** 对象字面量 */
  ObjectLiteral = "ObjectLiteral",

  /** 数组字面量 */
  ArrayLiteral = "ArrayLiteral",

  /** 模板字符串 */
  TemplateLiteral = "TemplateLiteral",

  /** 二元运算表达式 */
  BinaryOperation = "BinaryOperation",

  /** 三元运算表达式 */
  TernaryOperation = "TernaryOperation",

  /** 函数表达式赋值 */
  FunctionExpression = "FunctionExpression",

  /** 属性访问表达式 */
  PropertyAccess = "PropertyAccess",

  /** 简单变量赋值 */
  SimpleAssignment = "SimpleAssignment",

  /** 独立的属性访问（无赋值） */
  StandalonePropertyAccess = "StandalonePropertyAccess",

  /** 独立的表达式语句 */
  ExpressionStatement = "ExpressionStatement",

  /** 对象字面量内部 */
  InsideObjectLiteral = "InsideObjectLiteral",

  /** 数组字面量内部 */
  InsideArrayLiteral = "InsideArrayLiteral",

  /** 类声明 */
  ClassDeclaration = "ClassDeclaration",

  /** 函数声明 */
  FunctionDeclaration = "FunctionDeclaration",

  /** 类型别名声明 */
  TypeAliasDeclaration = "TypeAliasDeclaration",

  /** 接口声明 */
  InterfaceDeclaration = "InterfaceDeclaration",

  /** 枚举声明 */
  EnumDeclaration = "EnumDeclaration",

  /** 泛型类型参数 */
  GenericTypeParameter = "GenericTypeParameter",

  /** 类型注解 */
  TypeAnnotation = "TypeAnnotation",

  /** 接口属性 */
  InterfaceProperty = "InterfaceProperty",

  /** 枚举成员 */
  EnumMember = "EnumMember",

  /** 类型别名属性 */
  TypeAliasProperty = "TypeAliasProperty",

  /** 类型工具关键字 */
  TypeUtilityKeyword = "TypeUtilityKeyword",

  /** 类型引用（在 type/interface 声明右侧） */
  TypeReference = "TypeReference",
}

/**
 * 上下文元数据
 * 存储额外的上下文信息
 */
export interface ContextMetadata {
  /** 深层属性路径 */
  propertyPath?: string;

  /** 属性所在行号 */
  propertyLine?: number;

  /** 是否是异步调用 */
  isAsync?: boolean;

  /** 完整的表达式文本 */
  expressionText?: string;
}

/**
 * 代码上下文信息
 */
export interface CodeContext {
  /** 上下文类型 */
  type: CodeContextType;

  /** 元数据 */
  metadata?: ContextMetadata;
}
