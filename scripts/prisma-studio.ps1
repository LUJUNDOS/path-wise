# PATH-WISE Prisma Studio 启动脚本 (Windows PowerShell)

Write-Host "🚀 启动 Prisma Studio..." -ForegroundColor Cyan

# 进入 apps/api 目录
$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ApiDir = Join-Path $ScriptRoot "apps/api"

if (-not (Test-Path $ApiDir)) {
    Write-Host "❌ 错误: 找不到 apps/api 目录" -ForegroundColor Red
    exit 1
}

Set-Location $ApiDir

# 检查 Node.js 是否安装
if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
    Write-Host "❌ 错误: 找不到 npx，请确保 Node.js 已安装" -ForegroundColor Red
    exit 1
}

Write-Host "📊 Prisma Studio 启动中..." -ForegroundColor Green
Write-Host "📍 将在浏览器打开: http://localhost:5555" -ForegroundColor Cyan
Write-Host ""
Write-Host "💡 提示: 关闭此窗口不会停止 Prisma Studio" -ForegroundColor Yellow
Write-Host "💡 要停止 Prisma Studio，请按 Ctrl+C" -ForegroundColor Yellow
Write-Host ""

npx prisma studio
