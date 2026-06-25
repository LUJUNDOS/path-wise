# 代码异味清单（Code Smells Catalog）

这是一个用于识别代码异味的简明参考表。

## 常见 Code Smells

### 过长方法（Long Method）

**表现**

- 方法超过 30-50 行
- 多层嵌套
- 需要靠注释区分段落

**可用重构手法**

- Extract Method
- Replace Temp with Query
- Introduce Parameter Object

### 过大的类（Large Class）

**表现**

- 字段过多
- 方法过多
- 职责明显混杂

**可用重构手法**

- Extract Class
- Extract Subclass

### 基本类型偏执（Primitive Obsession）

**表现**

- 用基础类型表示复杂领域概念
- 到处都是 magic strings / numbers

**可用重构手法**

- Replace Primitive with Object
- Replace Type Code with Class

### 过长参数列表（Long Parameter List）

**表现**

- 参数 4 个以上
- 参数经常成组出现

**可用重构手法**

- Introduce Parameter Object
- Preserve Whole Object

### 数据泥团（Data Clumps）

**表现**

- 相同一组字段总是一起出现

**可用重构手法**

- Extract Class
- Introduce Parameter Object
