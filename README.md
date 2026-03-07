# Luminalog 官网

这是 Luminalog VS Code 扩展的官方网站。

## 🚀 在线访问

访问 [https://lynn1286.github.io/luminalog](https://lynn1286.github.io/luminalog) 查看官网。

## 📦 本地开发

由于是纯静态网站，直接打开 `index.html` 即可：

```bash
# 使用 Python 启动本地服务器
cd website
python3 -m http.server 8000

# 或使用 Node.js
npx serve .

# 或使用 VS Code Live Server 扩展
```

然后访问 `http://localhost:8000`

## 📁 项目结构

```
website/
├── index.html          # 主页
├── css/
│   └── style.css      # 样式文件
├── js/
│   └── main.js        # 交互逻辑
├── images/            # 图片资源
└── docs/              # 文档页面
    ├── configuration.html
    ├── usage.html
    └── api.html
```

## 🎨 设计特点

- **深色主题**：开发者友好的深色界面
- **彩色点缀**：使用插件的彩色日志风格
- **响应式设计**：完美适配桌面和移动设备
- **交互式演示**：在线体验插件功能
- **纯静态**：无需构建工具，直接部署

## 🚀 部署到 GitHub Pages

1. 将 `website` 目录内容推送到 `gh-pages` 分支：

```bash
# 方法 1：使用 git subtree
git subtree push --prefix website origin gh-pages

# 方法 2：手动部署
cd website
git init
git add .
git commit -m "Deploy website"
git branch -M gh-pages
git remote add origin https://github.com/lynn1286/luminalog.git
git push -f origin gh-pages
```

2. 在 GitHub 仓库设置中启用 GitHub Pages，选择 `gh-pages` 分支

3. 访问 `https://lynn1286.github.io/luminalog`

## 📝 更新网站

修改文件后，重新推送到 `gh-pages` 分支：

```bash
git subtree push --prefix website origin gh-pages
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进网站！

## 📄 许可证

MIT License
