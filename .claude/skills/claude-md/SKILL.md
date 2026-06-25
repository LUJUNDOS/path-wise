---
name: claude-md
description: 按最佳实践创建或更新 CLAUDE.md，帮助 AI agent 更快理解项目。Use when users want to create, update, audit, or improve a CLAUDE.md file.
---

# CLAUDE.md / 项目记忆整理

## 用户输入

```text
$ARGUMENTS
```

支持的意图：

- `create`
- `update`
- `audit`
- 指定某个路径下的 `CLAUDE.md`

## 核心原则

- `CLAUDE.md` 是 Claude Code 自动加载的长期项目上下文
- 内容要短、准、长期有效
- 不要把 lint / format 规则硬塞进去
- 不要把一次性任务说明塞进去
- 不要自动生成一堆无价值内容

## 推荐结构

- Project Overview
- Tech Stack
- Project Structure
- Development Commands
- Critical Conventions
- Known Issues / Gotchas

## 执行流程

### create（创建）

1. 分析项目结构和技术栈
2. 草拟 `CLAUDE.md`
3. 给用户审阅
4. 确认后写入

### update（更新）

1. 读取现有 `CLAUDE.md`
2. 找出冗余、过时或不该存在的内容
3. 给出优化建议
4. 审阅后更新

### audit（审计）

1. 检查行数和结构
2. 识别 anti-patterns
3. 输出报告，不直接改文件

## 质量约束

- 目标尽量少于 300 行
- 面向所有会话都适用
- 尽量用文件引用替代长代码块
- 命令必须真实可用
