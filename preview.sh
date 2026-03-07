#!/bin/bash

echo "🚀 启动 Luminalog 官网预览..."
echo "📍 访问地址: http://localhost:8000"
echo "⏹️  按 Ctrl+C 停止服务器"
echo ""

cd "$(dirname "$0")"
python3 -m http.server 8000
