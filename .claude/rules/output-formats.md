# 输出格式要求

> 由 `CLAUDE.md` 按需加载。生成代码/提交/测试报告时参考。

---

## 代码生成

```typescript
/**
 * [功能简述]
 * @param paramName - 参数说明
 * @returns 返回值说明
 * @throws {ErrorType} 异常条件说明
 */
async function functionName(param: ParamType): Promise<ReturnType> {
  // 1. 参数校验
  // 2. 核心逻辑
  // 3. 错误处理
}
```

## 提交信息（Commit Message）

遵循 Conventional Commits，**中文描述**：

```
<type>(<scope>): <简短描述>

<详细说明（可选）>

Refs: #<issue号>
```

| type       | 用途               |
| ---------- | ------------------ |
| `feat`     | 新功能             |
| `fix`      | 修复 Bug           |
| `docs`     | 文档变更           |
| `refactor` | 重构（不改变功能） |
| `test`     | 测试相关           |
| `chore`    | 工具链 / 配置变更  |

示例：

```
feat(api): 实现高德地图 POI 搜索适配器

- AmapAdapter 封装签名和请求
- Redis 缓存 POI 结果（TTL: 24h）
- 错误码映射到统一 ErrorCode

Refs: #12
```

## 测试反馈格式

测试报告必须包含：

```
## 审查报告 vX.Y.Z

### 审查范围：[文件/模块/功能]

### 问题清单

| # | 级别 | 位置 | 问题描述 | docs 依据 | 建议 |
|---|------|------|----------|-----------|------|

### 代码偏离标记（实现 ≠ 设计）

| 设计要求 | 代码现状 | 设计文档出处 | 严重性 |
|----------|----------|-------------|--------|

### 统计： P0=?, P1=?, P2=?, P3=?
```
