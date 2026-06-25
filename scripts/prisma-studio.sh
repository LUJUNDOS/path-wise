#!/usr/bin/env bash
# PATH-WISE Prisma Studio 启动脚本

echo "🚀 启动 Prisma Studio..."

# 进入 apps/api 目录
cd "$(dirname "$0")/../apps/api" || exit 1

# 检查 Prisma 是否安装
if ! command -v npx &> /dev/null; then
    echo "❌ 错误: 找不到 npx，请确保 Node.js 已安装"
    exit 1
fi

# 启动 Prisma Studio
echo "📊 Prisma Studio 启动中..."
echo "📍 将在浏览器打开: http://localhost:5555"
echo ""
echo "💡 提示: 关闭此终端窗口不会停止 Prisma Studio"
echo "💡 要停止 Prisma Studio，请按 Ctrl+C 或关闭此窗口"
echo ""

npx prisma studio
