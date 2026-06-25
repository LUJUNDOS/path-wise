# 代码审查问题模板（Code Review Finding Template）

## 问题：[标题]

### 严重程度

- [ ] Critical（严重）
- [ ] High（高）
- [ ] Medium（中）
- [ ] Low（低）

### 分类

- [ ] Security（安全）
- [ ] Performance（性能）
- [ ] Code Quality（代码质量）
- [ ] Maintainability（可维护性）
- [ ] Testing（测试）
- [ ] Design Pattern（设计模式）
- [ ] Documentation（文档）

### 位置

**文件:** `src/components/UserCard.tsx`<br>
**行号:** 45-52<br>
**函数/方法:** `renderUserDetails()`

### 问题描述

- **问题是什么**
- **为什么重要**
- **当前行为**
- **期望行为**

### 代码示例

#### 当前写法

```typescript
const users = fetchUsers();
users.forEach(user => {
  const posts = fetchUserPosts(user.id);
  renderUserPosts(posts);
});
```

#### 建议修复

```typescript
const usersWithPosts = fetchUsersWithPosts();
usersWithPosts.forEach(({ user, posts }) => {
  renderUserPosts(posts);
});
```

### 影响分析

| 方面 | 影响 | 严重程度 |
|--------|--------|----------|
| Performance（性能） | [描述] | High（高） |
| User Experience（用户体验） | [描述] | High（高） |
| Scalability（可扩展性） | [描述] | Critical（严重） |
| Maintainability（可维护性） | [描述] | Medium（中） |
