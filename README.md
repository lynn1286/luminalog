<div align="center">

# 🎨 LuminaLog

**赋予 console.log 灵魂，让调试成为一种视觉享受**

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/lynn1286.luminalog.svg)](https://marketplace.visualstudio.com/items?itemName=lynn1286.luminalog)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.95+-007ACC.svg)](https://code.visualstudio.com/)

[English](./README.en.md) | 简体中文

</div>

---

## 📥 安装

在 VS Code 扩展市场搜索 `LuminaLog`，或者直接访问：

**[🔗 VS Code Marketplace - LuminaLog](https://marketplace.visualstudio.com/items?itemName=lynn1286.luminalog)**

---

## ✨ 功能特性

| 功能类别          | 功能描述                                                                 |
| ----------------- | ------------------------------------------------------------------------ |
| 🎨 **智能样式**   | 自动添加随机 emoji 前缀 · 彩色背景和字体样式 · 可自定义 emoji 和颜色列表 |
| 🎯 **智能分析**   | 基于 AST 的代码分析 · 自动识别变量、函数、类名 · 精确计算插入位置和缩进  |
| 🚀 **高效操作**   | 快捷键快速插入日志 · 批量注释/取消注释 · 一键删除所有日志                |
| ⚙️ **高度可定制** | 10+ 配置选项 · 支持自定义前缀 · 灵活的引号和分号设置                     |

## 📦 支持的文件类型

| 语言       | 扩展名        | 状态 |
| ---------- | ------------- | :--: |
| JavaScript | `.js`         |  ✅  |
| TypeScript | `.ts`         |  ✅  |
| React      | `.jsx` `.tsx` |  ✅  |
| Vue        | `.vue`        |  ✅  |
| Svelte     | `.svelte`     |  ✅  |
| Astro      | `.astro`      |  ✅  |
| HTML       | `.html`       |  ✅  |

---

## 🚀 快速开始

### 插入日志

1. 选中要调试的变量或表达式
2. 按下快捷键 `Cmd+Alt+L`（Mac）或 `Ctrl+Alt+L`（Windows/Linux）
3. 日志语句将自动插入到下一行，并携带类名、函数名等上下文信息

```typescript
// 选中 userName 后按快捷键
const userName = "Alice";

// 自动生成 👇
console.log("🎯 MyClass -> getUserInfo -> userName: ", userName);
```

### ⌨️ 快捷键一览

| 功能             |       Mac       |  Windows/Linux   |
| :--------------- | :-------------: | :--------------: |
| 插入日志         |   `Cmd+Alt+L`   |   `Ctrl+Alt+L`   |
| 注释所有日志     |   `Cmd+Alt+C`   |   `Ctrl+Alt+C`   |
| 取消注释所有日志 |   `Cmd+Alt+U`   |   `Ctrl+Alt+U`   |
| 删除所有日志     | `Cmd+Alt+D` `L` | `Ctrl+Alt+D` `L` |

---

## ⚙️ 配置选项

| 配置项                    | 类型      | 默认值   | 说明                     |
| ------------------------- | --------- | -------- | ------------------------ |
| `wrapLogMessage`          | `boolean` | `false`  | 用分隔线包裹日志消息     |
| `logMessagePrefix`        | `string`  | `""`     | 日志消息的自定义前缀     |
| `randomEmojiPrefix`       | `boolean` | `true`   | 添加随机 emoji 前缀      |
| `addSemicolonInTheEnd`    | `boolean` | `false`  | 在末尾添加分号           |
| `insertEnclosingClass`    | `boolean` | `true`   | 插入所在类名             |
| `insertEnclosingFunction` | `boolean` | `true`   | 插入所在函数名           |
| `quote`                   | `string`  | `"`      | 引号风格（`"` 或 `'`）   |
| `makeLogColorful`         | `boolean` | `true`   | 添加颜色样式             |
| `logMessageFontSize`      | `number`  | `16`     | 字体大小（px）           |
| `contextSeparator`        | `string`  | `" -> "` | 上下文各部分之间的分隔符 |
| `customEmojis`            | `array`   | 见下方   | 自定义 emoji 列表        |
| `customColors`            | `array`   | 见下方   | 自定义颜色列表           |

### 🎨 主题示例

<details>
<summary>🐛 调试主题</summary>

```json
{
  "luminalog.customEmojis": ["🐛", "🔧", "⚙️", "🔍", "💻"],
  "luminalog.customColors": ["#E74C3C", "#3498DB", "#2ECC71", "#F39C12", "#9B59B6"]
}
```

</details>

<details>
<summary>🌈 彩虹主题</summary>

```json
{
  "luminalog.customEmojis": ["🌈", "🎨", "✨", "🎉", "🌟"],
  "luminalog.customColors": [
    "#FF0000",
    "#FF7F00",
    "#FFFF00",
    "#00FF00",
    "#0000FF",
    "#4B0082",
    "#9400D3"
  ]
}
```

</details>

<details>
<summary>🎨 简约主题</summary>

```json
{
  "luminalog.customEmojis": ["●", "○", "◆", "◇", "▪"],
  "luminalog.customColors": ["#2C3E50", "#34495E", "#7F8C8D", "#95A5A6", "#BDC3C7"],
  "luminalog.makeLogColorful": true
}
```

</details>

<details>
<summary>📋 默认 Emoji 与颜色列表</summary>

**Emoji 列表**：

```json
["🔍", "🎯", "🚀", "💡", "⚡", "🎨", "🔥", "✨", "🎉", "🌟"]
```

**颜色列表**：

```json
[
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#FFA07A",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E2",
  "#F8B739",
  "#52B788"
]
```

</details>

---

## 🏗️ 架构设计

```
src/
├── commands/                      # 命令实现
│   ├── display-log-message.ts
│   ├── comment-all-log-messages.ts
│   ├── uncomment-all-log-messages.ts
│   └── delete-all-log-messages.ts
├── constants/                     # 常量定义
│   ├── commands.ts
│   ├── config.ts
│   └── regex.ts
├── core/                          # 核心逻辑
│   ├── ast-utils.ts
│   ├── code-analyzer.ts
│   ├── insertion-engine.ts
│   ├── log-message-generator.ts
│   ├── context/
│   │   ├── recognizer.ts
│   │   └── types.ts
│   └── position/
│       └── calculators.ts
├── services/                      # 服务层
│   ├── emoji-service.ts
│   ├── color-service.ts
│   ├── config-service.ts
│   └── log-message-service.ts
├── types/                         # 类型定义
│   ├── index.ts
│   └── services.ts
├── utils/                         # 工具函数
│   ├── editor-helper.ts
│   └── error-handler.ts
└── extension.ts                   # 扩展入口
```

**核心流程：**

```
用户选中变量
    → CodeAnalyzer 分析代码结构
    → 计算插入位置和缩进
    → EmojiService + ColorService 生成样式
    → LogMessageGenerator 生成日志语句
    → 插入到编辑器
```

---

## 🛠️ 开发指南

### 环境要求

| 工具    | 版本要求  |
| :------ | :-------: |
| Node.js | >= 18.0.0 |
| npm     | >= 8.0.0  |
| VS Code | >= 1.95.0 |

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/lynn1286/luminalog.git
cd luminalog

# 安装依赖
npm install

# 编译 TypeScript
npm run compile

# 监听模式（自动编译）
npm run compile:watch
```

在 VS Code 中按 `F5` 启动扩展开发宿主，即可实时调试扩展。

### 测试

```bash
npm test              # 运行所有测试
npm run test:watch    # 监听模式
npm run test:ui       # 可视化界面
npm run test:coverage # 覆盖率报告
```

### 打包与发布

```bash
# 打包扩展（生成 .vsix 文件）
npm run package

# 安装到本地 VS Code
code --install-extension luminalog-*.vsix
```

### 技术栈

| 技术                                                                                                         | 用途                                      |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| [TypeScript](https://www.typescriptlang.org/)                                                                | 类型安全                                  |
| [Acorn](https://github.com/acornjs/acorn) + [acorn-typescript](https://github.com/TyrealHu/acorn-typescript) | AST 解析，支持 TS / JSX / Vue / Svelte 等 |
| [Vitest](https://vitest.dev/)                                                                                | 测试框架，单元测试覆盖率 >90%             |
| [ESLint](https://eslint.org/) + [Prettier](https://prettier.io/)                                             | 代码质量与格式化                          |

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！在提交 PR 之前，请确保：

- ✅ 通过所有测试（`npm test`）
- ✅ 代码格式正确（`npm run format`）
- ✅ 通过 ESLint 检查（`npm run lint`）

## 📄 许可证

[MIT](LICENSE) © 2024-present [lynn1286](https://github.com/lynn1286)

---

## 💖 致谢

特别感谢 [Turbo Console Log](https://github.com/Chakroun-Anas/turbo-console-log) 的作者 **Chakroun Anas**，本项目从该仓库获取了大量灵感，在此致以诚挚的谢意！

---

<div align="center">

**如果这个项目对你有帮助，请给个 ⭐️ Star 支持一下！**

Made with ❤️ by [lynn1286](https://github.com/lynn1286)

</div>
