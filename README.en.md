<div align="center">

# 🎨 LuminaLog

**Add soul to console.log and make debugging a visual delight**

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/lynn1286.luminalog.svg)](https://marketplace.visualstudio.com/items?itemName=lynn1286.luminalog)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.95+-007ACC.svg)](https://code.visualstudio.com/)

English | [简体中文](./README.md)

</div>

---

## 📥 Installation

Search for `LuminaLog` in the VS Code Extensions Marketplace, or visit:

**[🔗 VS Code Marketplace - LuminaLog](https://marketplace.visualstudio.com/items?itemName=lynn1286.luminalog)**

---

## ✨ Features

| Category                    | Description                                                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 🎨 **Smart Styling**        | Auto-add random emoji prefixes · Colorful background & font styles · Customizable emoji and color lists              |
| 🎯 **Intelligent Analysis** | AST-based code analysis · Auto-detect variables, functions, and class names · Precise insertion position calculation |
| 🚀 **Efficient Operations** | Quick keyboard shortcuts · Batch comment/uncomment · One-click delete all logs                                       |
| ⚙️ **Highly Customizable**  | 10+ configuration options · Custom prefix support · Flexible quote and semicolon settings                            |

## 📦 Supported File Types

| Language   | Extensions    | Status |
| ---------- | ------------- | :----: |
| JavaScript | `.js`         |   ✅   |
| TypeScript | `.ts`         |   ✅   |
| React      | `.jsx` `.tsx` |   ✅   |
| Vue        | `.vue`        |   ✅   |
| Svelte     | `.svelte`     |   ✅   |
| Astro      | `.astro`      |   ✅   |
| HTML       | `.html`       |   ✅   |

---

## 🚀 Quick Start

### Insert Log

1. Select the variable or expression you want to debug
2. Press `Cmd+Alt+L` (Mac) or `Ctrl+Alt+L` (Windows/Linux)
3. The log statement is automatically inserted on the next line, with class name, function name, and other context

```typescript
// Select userName and press the shortcut
const userName = "Alice";

// Auto-generated 👇
console.log("🎯 MyClass -> getUserInfo -> userName: ", userName);
```

### ⌨️ Keyboard Shortcuts

| Feature            |       Mac       |  Windows/Linux   |
| :----------------- | :-------------: | :--------------: |
| Insert log         |   `Cmd+Alt+L`   |   `Ctrl+Alt+L`   |
| Comment all logs   |   `Cmd+Alt+C`   |   `Ctrl+Alt+C`   |
| Uncomment all logs |   `Cmd+Alt+U`   |   `Ctrl+Alt+U`   |
| Delete all logs    | `Cmd+Alt+D` `L` | `Ctrl+Alt+D` `L` |

---

## ⚙️ Configuration Options

| Option                    | Type      | Default   | Description                            |
| ------------------------- | --------- | --------- | -------------------------------------- |
| `wrapLogMessage`          | `boolean` | `false`   | Wrap log messages with separator lines |
| `logMessagePrefix`        | `string`  | `""`      | Custom prefix for log messages         |
| `randomEmojiPrefix`       | `boolean` | `true`    | Add a random emoji prefix              |
| `addSemicolonInTheEnd`    | `boolean` | `false`   | Add semicolon at the end               |
| `insertEnclosingClass`    | `boolean` | `true`    | Insert enclosing class name            |
| `insertEnclosingFunction` | `boolean` | `true`    | Insert enclosing function name         |
| `quote`                   | `string`  | `"`       | Quote style (`"` or `'`)               |
| `makeLogColorful`         | `boolean` | `true`    | Add color styles                       |
| `logMessageFontSize`      | `number`  | `16`      | Font size (px)                         |
| `contextSeparator`        | `string`  | `" -> "`  | Separator between context parts        |
| `customEmojis`            | `array`   | See below | Custom emoji list                      |
| `customColors`            | `array`   | See below | Custom color list                      |

### 🎨 Theme Examples

<details>
<summary>🐛 Debug Theme</summary>

```json
{
  "luminalog.customEmojis": ["🐛", "🔧", "⚙️", "🔍", "💻"],
  "luminalog.customColors": ["#E74C3C", "#3498DB", "#2ECC71", "#F39C12", "#9B59B6"]
}
```

</details>

<details>
<summary>🌈 Rainbow Theme</summary>

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
<summary>🎨 Minimalist Theme</summary>

```json
{
  "luminalog.customEmojis": ["●", "○", "◆", "◇", "▪"],
  "luminalog.customColors": ["#2C3E50", "#34495E", "#7F8C8D", "#95A5A6", "#BDC3C7"],
  "luminalog.makeLogColorful": true
}
```

</details>

<details>
<summary>📋 Default Emoji & Color Lists</summary>

**Emoji List**:

```json
["🔍", "🎯", "🚀", "💡", "⚡", "🎨", "🔥", "✨", "🎉", "🌟"]
```

**Color List**:

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

## 🏗️ Architecture

```
src/
├── commands/                      # Command implementations
│   ├── display-log-message.ts
│   ├── comment-all-log-messages.ts
│   ├── uncomment-all-log-messages.ts
│   └── delete-all-log-messages.ts
├── constants/                     # Constants
│   ├── commands.ts
│   ├── config.ts
│   └── regex.ts
├── core/                          # Core logic
│   ├── ast-utils.ts
│   ├── code-analyzer.ts
│   ├── insertion-engine.ts
│   ├── log-message-generator.ts
│   ├── context/
│   │   ├── recognizer.ts
│   │   └── types.ts
│   └── position/
│       └── calculators.ts
├── services/                      # Service layer
│   ├── emoji-service.ts
│   ├── color-service.ts
│   ├── config-service.ts
│   └── log-message-service.ts
├── types/                         # Type definitions
│   ├── index.ts
│   └── services.ts
├── utils/                         # Utility functions
│   ├── editor-helper.ts
│   └── error-handler.ts
└── extension.ts                   # Extension entry
```

**Core Flow:**

```
User selects variable
    → CodeAnalyzer analyzes code structure
    → Calculate insertion position and indentation
    → EmojiService + ColorService generate styles
    → LogMessageGenerator builds the log statement
    → Insert into editor
```

---

## 🛠️ Development Guide

### Requirements

| Tool    |  Version  |
| :------ | :-------: |
| Node.js | >= 18.0.0 |
| npm     | >= 8.0.0  |
| VS Code | >= 1.95.0 |

### Local Development

```bash
# Clone the repository
git clone https://github.com/lynn1286/luminalog.git
cd luminalog

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode (auto-compile)
npm run compile:watch
```

Press `F5` in VS Code to launch the Extension Development Host for live debugging.

### Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:ui       # Visual interface
npm run test:coverage # Coverage report
```

### Packaging & Publishing

```bash
# Package the extension (generates a .vsix file)
npm run package

# Install to local VS Code
code --install-extension luminalog-*.vsix
```

### Tech Stack

| Technology                                                                                                   | Purpose                                               |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| [TypeScript](https://www.typescriptlang.org/)                                                                | Type safety                                           |
| [Acorn](https://github.com/acornjs/acorn) + [acorn-typescript](https://github.com/TyrealHu/acorn-typescript) | AST parsing — supports TS, JSX, Vue, Svelte, and more |
| [Vitest](https://vitest.dev/)                                                                                | Testing framework, unit test coverage >90%            |
| [ESLint](https://eslint.org/) + [Prettier](https://prettier.io/)                                             | Code quality and formatting                           |

---

## 🤝 Contributing

Issues and Pull Requests are welcome! Before submitting a PR, please make sure:

- ✅ All tests pass (`npm test`)
- ✅ Code is formatted (`npm run format`)
- ✅ Passes ESLint checks (`npm run lint`)

## 📄 License

[MIT](LICENSE) © 2024-present [lynn1286](https://github.com/lynn1286)

---

## 💖 Acknowledgement

Special thanks to **Chakroun Anas**, the author of [Turbo Console Log](https://github.com/Chakroun-Anas/turbo-console-log). This project drew a great deal of inspiration from that repository — thank you for the wonderful work!

---

<div align="center">

**If this project helps you, please give it a ⭐️ Star!**

Made with ❤️ by [lynn1286](https://github.com/lynn1286)

</div>
