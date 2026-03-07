#!/bin/bash

# Luminalog 官网部署脚本
# 将 website 目录部署到 GitHub Pages (gh-pages 分支)

set -e

echo "🚀 开始部署 Luminalog 官网..."

# 检查是否在项目根目录
if [ ! -d "website" ]; then
    echo "❌ 错误: 请在项目根目录运行此脚本"
    exit 1
fi

# 检查是否有未提交的更改
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  警告: 有未提交的更改"
    read -p "是否继续部署? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 进入 website 目录
cd website

echo "📦 准备部署文件..."

# 创建临时目录
TEMP_DIR=$(mktemp -d)
echo "临时目录: $TEMP_DIR"

# 复制文件到临时目录
cp -r * "$TEMP_DIR/"
cp -r .??* "$TEMP_DIR/" 2>/dev/null || true

# 进入临时目录
cd "$TEMP_DIR"

# 初始化 git（如果需要）
if [ ! -d ".git" ]; then
    git init
    git config user.name "GitHub Actions"
    git config user.email "actions@github.com"
fi

# 添加所有文件
git add -A

# 提交
git commit -m "Deploy website - $(date '+%Y-%m-%d %H:%M:%S')" || {
    echo "ℹ️  没有更改需要提交"
    cd -
    rm -rf "$TEMP_DIR"
    exit 0
}

# 推送到 gh-pages 分支
echo "📤 推送到 GitHub Pages..."
git branch -M gh-pages

# 获取远程仓库地址
cd - > /dev/null
REMOTE_URL=$(git config --get remote.origin.url)

cd "$TEMP_DIR"
git remote add origin "$REMOTE_URL" 2>/dev/null || git remote set-url origin "$REMOTE_URL"

# 强制推送
git push -f origin gh-pages

echo "✅ 部署成功!"
echo "🌐 网站将在几分钟后更新: https://lynn1286.github.io/luminalog"

# 清理临时目录
cd - > /dev/null
rm -rf "$TEMP_DIR"

echo "🎉 完成!"
