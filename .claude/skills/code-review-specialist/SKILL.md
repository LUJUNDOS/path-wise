---
name: code-review-specialist
description: 综合代码审查 skill，覆盖安全、性能、代码质量和可维护性。Use when users ask to review code, analyze code quality, evaluate pull requests, or mention code review, security analysis, or performance optimization.
---

# 代码审查专家技能（Code Review Specialist Skill）

> 本 skill 使用 `code-review-specialist` 名称，避免遮蔽 Claude Code `v2.1.146+` 自带的 `/code-review` 命令。

这个 skill 用于做结构化代码审查，重点关注：

1. **Security Analysis**
2. **Performance Review**
3. **Code Quality**
4. **Maintainability**

## 审查模板

## 参考文件

这个 skill 自带模板和脚本，做正式审查时应按需读取：

- `templates/review-checklist.md`：结构化检查清单，覆盖安全、性能、质量和测试，避免漏掉大类。
- `templates/finding-template.md`：单个问题的记录模板，包含严重程度、位置、代码示例和影响分析。
- `scripts/analyze-metrics.py`：统计函数数、类数、平均行长和复杂度分数，可用于给审查补充量化依据。
- `scripts/compare-complexity.py`：对比两个版本的复杂度，适合审查重构前后的变化。

### 总结

- Overall quality assessment
- Key findings count
- Recommended priority areas

### 严重问题

- **Issue**
- **Location**
- **Impact**
- **Severity**
- **Fix**

### 按类别列出问题

#### 安全

列出安全漏洞或风险点

#### 性能

列出性能问题与复杂度风险

#### 质量

列出命名、结构、文档和测试问题

#### 可维护性

列出可维护性问题和重构建议
