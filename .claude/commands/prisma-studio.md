# Prisma Studio

启动 PATH-WISE 项目的 Prisma Studio 数据库管理界面。

## 用法

```bash
/prisma-studio
```

## 功能

- 📊 可视化查看数据库表结构（`users`、`trips`、`city_knowledge`）
- ➕ 添加/编辑/删除记录
- 🔍 筛选和搜索数据
- 🔗 查看表之间的关系

## 启动方式

1. 自动在 `apps/api` 目录下启动 Prisma
2. 浏览器自动打开 `http://localhost:5555`
3. 在后台持续运行，不阻塞终端

## 停止方式

- 按 `Ctrl+C` 停止服务
- 或关闭终端窗口

## 前置要求

- ✅ PostgreSQL 容器正在运行（`docker-compose up -d`）
- ✅ `.env` 文件已配置 `DATABASE_URL`

## 故障排除

**端口 5555 被占用**：

```bash
netstat -ano | findstr :5555
```

查看占用进程并停止

**数据库连接失败**：

```bash
docker ps | grep pathwise-postgres
```

确认 PostgreSQL 容器正在运行
