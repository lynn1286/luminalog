#!/bin/bash

echo "=== 检查 VS Code 语言设置 ==="
echo ""

# 检查 VS Code 配置文件
VSCODE_CONFIG="$HOME/Library/Application Support/Code/User/locale.json"

if [ -f "$VSCODE_CONFIG" ]; then
    echo "VS Code locale.json 内容："
    cat "$VSCODE_CONFIG"
else
    echo "未找到 locale.json，VS Code 使用系统默认语言"
fi

echo ""
echo "=== 系统语言设置 ==="
echo "LANG: $LANG"
echo "LC_ALL: $LC_ALL"

echo ""
echo "=== 测试国际化 ==="
echo "打包并检查文件..."
npm run package > /dev/null 2>&1

VSIX_FILE=$(ls -t luminalog-*.vsix | head -1)
echo "检查 $VSIX_FILE 中的国际化文件："
unzip -l "$VSIX_FILE" | grep "package.nls"
