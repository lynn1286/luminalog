// ==================== 移动端菜单 ====================
const mobileMenuToggle = document.querySelector(".mobile-menu-toggle");
const navMenu = document.querySelector(".nav-menu");

if (mobileMenuToggle) {
  mobileMenuToggle.addEventListener("click", () => {
    navMenu.classList.toggle("active");
    mobileMenuToggle.classList.toggle("active");
  });
}

// 点击菜单项后关闭移动端菜单
document.querySelectorAll(".nav-menu a").forEach(link => {
  link.addEventListener("click", () => {
    navMenu.classList.remove("active");
    mobileMenuToggle.classList.remove("active");
  });
});

// ==================== 复制按钮 ====================
document.querySelectorAll(".copy-btn").forEach(btn => {
  btn.addEventListener("click", async () => {
    const textToCopy = btn.getAttribute("data-copy");
    try {
      await navigator.clipboard.writeText(textToCopy);
      const originalText = btn.textContent;
      btn.textContent = "已复制!";
      setTimeout(() => {
        btn.textContent = originalText;
      }, 2000);
    } catch (err) {
      console.error("复制失败:", err);
    }
  });
});

// ==================== 交互式演示 ====================
const codeEditor = document.getElementById("codeEditor");
const outputConsole = document.getElementById("outputConsole");
const insertLogBtn = document.getElementById("insertLogBtn");
const clearOutputBtn = document.getElementById("clearOutputBtn");

// 随机颜色列表（来自插件配置）
const colors = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#FFA07A",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E2",
  "#F8B739",
  "#52B788",
];

// 随机 emoji 列表
const emojis = ["🔍", "🎯", "🚀", "💡", "⚡", "🎨", "🔥", "✨", "🎉", "🌟"];

// 获取随机颜色
function getRandomColor() {
  return colors[Math.floor(Math.random() * colors.length)];
}

// 获取随机 emoji
function getRandomEmoji() {
  return emojis[Math.floor(Math.random() * emojis.length)];
}

// 计算亮度
function getLuminance(hex) {
  const rgb = parseInt(hex.slice(1), 16);
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = (rgb >> 0) & 0xff;
  return (r * 0.299 + g * 0.587 + b * 0.114) / 255;
}

// 根据背景色选择文字颜色
function getTextColor(bgColor) {
  return getLuminance(bgColor) > 0.5 ? "black" : "white";
}

// 简单的函数名提取
function extractFunctionName(code, lineIndex) {
  const lines = code.split("\n");
  for (let i = lineIndex; i >= 0; i--) {
    const line = lines[i];
    // 匹配函数声明
    const funcMatch = line.match(/function\s+(\w+)\s*\(/);
    if (funcMatch) return funcMatch[1];

    // 匹配箭头函数
    const arrowMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/);
    if (arrowMatch) return arrowMatch[1];
  }
  return null;
}

// 插入日志
if (insertLogBtn) {
  insertLogBtn.addEventListener("click", () => {
    const code = codeEditor.value;
    const selectionStart = codeEditor.selectionStart;
    const selectionEnd = codeEditor.selectionEnd;

    if (selectionStart === selectionEnd) {
      alert("请先选中一个变量名");
      return;
    }

    const selectedText = code.substring(selectionStart, selectionEnd).trim();

    if (!selectedText || !/^[a-zA-Z_$][a-zA-Z0-9_$.]*$/.test(selectedText)) {
      alert("请选中一个有效的变量名");
      return;
    }

    // 获取当前行号
    const beforeSelection = code.substring(0, selectionStart);
    const lineIndex = beforeSelection.split("\n").length - 1;

    // 提取函数名
    const functionName = extractFunctionName(code, lineIndex);

    // 生成日志
    const emoji = getRandomEmoji();
    const bgColor = getRandomColor();
    const textColor = getTextColor(bgColor);

    const contextPath = functionName ? `${functionName} -> ${selectedText}` : selectedText;
    const logMessage = `console.log("%c ${emoji} ${contextPath} ", "font-size:16px;background-color:${bgColor};color:${textColor};", ${selectedText});`;

    // 在输出控制台显示
    const logDiv = document.createElement("div");
    logDiv.className = "console-log";
    logDiv.innerHTML = `
            <span style="font-size:16px;background-color:${bgColor};color:${textColor};padding:4px 8px;border-radius:4px;">
                ${emoji} ${contextPath}
            </span>
            <span style="color: var(--text-secondary); margin-left: 8px;">${selectedText}</span>
        `;
    outputConsole.appendChild(logDiv);

    // 滚动到底部
    outputConsole.scrollTop = outputConsole.scrollHeight;

    // 在编辑器中插入日志（找到合适的位置）
    const lines = code.split("\n");
    const currentLine = lines[lineIndex];
    const indent = currentLine.match(/^\s*/)[0];

    // 在当前行后插入
    let insertPosition = code.indexOf("\n", selectionStart);
    if (insertPosition === -1) insertPosition = code.length;

    const newCode =
      code.substring(0, insertPosition + 1) +
      indent +
      logMessage +
      "\n" +
      code.substring(insertPosition + 1);

    codeEditor.value = newCode;
  });
}

// 清空输出
if (clearOutputBtn) {
  clearOutputBtn.addEventListener("click", () => {
    outputConsole.innerHTML = "";
  });
}

// ==================== 平滑滚动 ====================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener("click", function (e) {
    const href = this.getAttribute("href");
    if (href === "#") return;

    e.preventDefault();
    const target = document.querySelector(href);
    if (target) {
      const navHeight = document.querySelector(".navbar").offsetHeight;
      const targetPosition = target.offsetTop - navHeight - 20;
      window.scrollTo({
        top: targetPosition,
        behavior: "smooth",
      });
    }
  });
});

// ==================== 导航栏滚动效果 ====================
let lastScroll = 0;
const navbar = document.querySelector(".navbar");

window.addEventListener("scroll", () => {
  const currentScroll = window.pageYOffset;

  if (currentScroll > 100) {
    navbar.style.boxShadow = "0 2px 10px rgba(0, 0, 0, 0.5)";
  } else {
    navbar.style.boxShadow = "none";
  }

  lastScroll = currentScroll;
});

// ==================== 代码编辑器 Tab 支持 ====================
if (codeEditor) {
  codeEditor.addEventListener("keydown", e => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = codeEditor.selectionStart;
      const end = codeEditor.selectionEnd;
      const value = codeEditor.value;

      codeEditor.value = value.substring(0, start) + "  " + value.substring(end);
      codeEditor.selectionStart = codeEditor.selectionEnd = start + 2;
    }
  });
}

// ==================== 页面加载动画 ====================
window.addEventListener("load", () => {
  document.body.classList.add("loaded");
});

// ==================== 统计数据动画 ====================
function animateValue(element, start, end, duration) {
  let startTimestamp = null;
  const step = timestamp => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const value = Math.floor(progress * (end - start) + start);
    element.textContent = value + (element.dataset.suffix || "");
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
}

// 当统计数据进入视口时触发动画
const statObserverOptions = {
  threshold: 0.5,
  rootMargin: "0px",
};

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting && !entry.target.classList.contains("animated")) {
      entry.target.classList.add("animated");
      const statValue = entry.target.querySelector(".stat-value");
      if (statValue) {
        const endValue = parseInt(statValue.textContent);
        const suffix = statValue.textContent.replace(/[0-9]/g, "");
        statValue.dataset.suffix = suffix;
        animateValue(statValue, 0, endValue, 1000);
      }
    }
  });
}, statObserverOptions);

document.querySelectorAll(".stat").forEach(stat => {
  observer.observe(stat);
});

// ==================== 特性卡片悬停效果 ====================
document.querySelectorAll(".feature-card").forEach(card => {
  card.addEventListener("mouseenter", function () {
    this.style.transform = "translateY(-8px) scale(1.02)";
  });

  card.addEventListener("mouseleave", function () {
    this.style.transform = "translateY(0) scale(1)";
  });
});

console.log(
  "%c 🚀 Luminalog Website ",
  "font-size:16px;background-color:#4ECDC4;color:black;padding:8px;border-radius:4px;",
  "Welcome!"
);

// ==================== 导航栏滚动效果增强 ====================
window.addEventListener("scroll", () => {
  const navbar = document.querySelector(".navbar");
  if (window.scrollY > 50) {
    navbar.classList.add("scrolled");
  } else {
    navbar.classList.remove("scrolled");
  }
});

// ==================== 元素进入视口动画 ====================
const fadeInObserverOptions = {
  threshold: 0.1,
  rootMargin: "0px 0px -100px 0px",
};

const fadeInObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("fade-in");
      fadeInObserver.unobserve(entry.target);
    }
  });
}, fadeInObserverOptions);

// 观察所有需要动画的元素
document.querySelectorAll(".feature-card, .doc-card, .install-card").forEach(el => {
  fadeInObserver.observe(el);
});

// ==================== 鼠标跟随光效 ====================
document.addEventListener("mousemove", e => {
  const hero = document.querySelector(".hero");
  if (!hero) return;

  const rect = hero.getBoundingClientRect();
  if (e.clientY < rect.bottom && e.clientY > rect.top) {
    const x = (e.clientX / window.innerWidth) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    hero.style.setProperty("--mouse-x", `${x}%`);
    hero.style.setProperty("--mouse-y", `${y}%`);
  }
});

// ==================== 代码窗口悬浮效果 ====================
const codeWindow = document.querySelector(".code-window");
if (codeWindow) {
  codeWindow.addEventListener("mousemove", e => {
    const rect = codeWindow.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = (y - centerY) / 20;
    const rotateY = (centerX - x) / 20;

    codeWindow.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px)`;
  });

  codeWindow.addEventListener("mouseleave", () => {
    codeWindow.style.transform = "perspective(1000px) rotateX(0) rotateY(0) translateY(0)";
  });
}

// ==================== 按钮波纹效果 ====================
document.querySelectorAll(".btn").forEach(button => {
  button.addEventListener("click", function (e) {
    const ripple = document.createElement("span");
    const rect = this.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    ripple.style.width = ripple.style.height = size + "px";
    ripple.style.left = x + "px";
    ripple.style.top = y + "px";
    ripple.classList.add("ripple");

    this.appendChild(ripple);

    setTimeout(() => ripple.remove(), 600);
  });
});

// 添加波纹样式
const style = document.createElement("style");
style.textContent = `
    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.6);
        transform: scale(0);
        animation: ripple-animation 0.6s ease-out;
        pointer-events: none;
    }

    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// ==================== 特性卡片交错动画 ====================
const featureCards = document.querySelectorAll(".feature-card");
featureCards.forEach((card, index) => {
  card.style.animationDelay = `${index * 0.1}s`;
});

// ==================== 平滑滚动到锚点 ====================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener("click", function (e) {
    const href = this.getAttribute("href");
    if (href === "#") return;

    e.preventDefault();
    const target = document.querySelector(href);
    if (target) {
      const navHeight = document.querySelector(".navbar").offsetHeight;
      const targetPosition = target.offsetTop - navHeight - 20;

      window.scrollTo({
        top: targetPosition,
        behavior: "smooth",
      });
    }
  });
});

console.log(
  "%c ✨ Luminalog Website Enhanced! ",
  "font-size:16px;background:linear-gradient(135deg, #667eea, #764ba2);color:white;padding:8px 16px;border-radius:8px;font-weight:bold;",
  "🚀"
);
