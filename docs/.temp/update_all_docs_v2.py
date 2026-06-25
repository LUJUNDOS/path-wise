#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
批量更新所有文档，将 normal_train（普速火车）和 bus（大巴）纳入大交通类型
"""

import sys
import io

# 设置标准输出为 UTF-8 编码
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import re

def update_frontend_specs():
    """更新前端交互设计规格书 - 补充 Section 3.6.1 的展示格式"""
    filepath = r"F:\WorkBuddy\2026-06-18-00-31-06\前端交互设计规格书_v1.0.0.md"
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 在 Section 3.6.1 的展示格式后添加普速火车和大巴的示例
    # 找到高铁示例的结束位置（在 ``` 之后）
    old_text = """```
┌──────────────────────────────────────────────────────┐
│ 🚄 大交通信息                                         │
│                                                      │
│  出发：北京南站 → 到达：长沙南站                       │
│  车次：G6113   日期：2026-07-01                        │
│  出发：16:45 → 到达：19:00   历时：2小时15分           │
│  座位：二等座 ¥314/人   一等座 ¥498/人                 │
│                                                      │
│  ⚠️ 车次/航班/大巴信息仅供参考，余票/班次动态变化，                   │
│     请尽快到 12306 / 携程 / 飞猪 订票                 │
│                                                      │
│  [查看实时余票]  (阶段二)                              │
└──────────────────────────────────────────────────────┘
```"""

    new_text = """```
┌──────────────────────────────────────────────────────┐
│ 🚄 大交通信息（高铁）                                   │
│                                                      │
│  出发：北京南站 → 到达：长沙南站                       │
│  车次：G6113   日期：2026-07-01                        │
│  出发：16:45 → 到达：19:00   历时：2小时15分           │
│  座位：二等座 ¥314/人   一等座 ¥498/人                 │
│                                                      │
│  ⚠️ 车次/航班/大巴信息仅供参考，余票/班次动态变化，                   │
│     请尽快到 12306 / 携程 / 飞猪 订票                 │
│                                                      │
│  [查看实时余票]  (阶段二)                              │
└──────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────┐
│ 🚃 大交通信息（普速火车）                                 │
│                                                      │
│  出发：北京西站 → 到达：长沙站                         │
│  车次：Z1   日期：2026-07-01                            │
│  出发：18:20 → 到达：次日 08:15   历时：13小时55分       │
│  座位：硬卧 ¥280/人   软卧 ¥450/人                     │
│  💤 隔夜车次，含卧铺                                     │
│                                                      │
│  ⚠️ 车次/航班/大巴信息仅供参考，余票/班次动态变化，                   │
│     请尽快到 12306 / 携程 / 飞猪 订票                 │
│                                                      │
│  [查看实时余票]  (阶段二)                              │
└──────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────┐
│ 🚌 大交通信息（长途大巴）                                 │
│                                                      │
│  出发：北京赵公口客运站 → 到达：长沙汽车东站               │
│  班次：高速直达   日期：2026-07-01                        │
│  出发：09:00 → 到达：次日 06:00   历时：21小时             │
│  座位：普通座 ¥380/人   商务座 ¥580/人                   │
│  💤 隔夜班次，建议准备颈枕                               │
│                                                      │
│  ⚠️ 车次/航班/大巴信息仅供参考，余票/班次动态变化，                   │
│     请尽快到 12306 / 携程 / 飞猪 订票                 │
│                                                      │
│  [查看实时余票]  (阶段二)                              │
└──────────────────────────────────────────────────────┘
```"""
    
    if old_text in content:
        content = content.replace(old_text, new_text)
        print("✅ 前端交互设计规格书 - Section 3.6.1 展示格式已更新")
    else:
        print("⚠️ 前端交互设计规格书 - 未找到匹配的旧文本，手动检查 needed")
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

def update_api_docs():
    """更新 API 接口设计规格书"""
    filepath = r"F:\WorkBuddy\2026-06-18-00-31-06\API接口设计规格书_v1.0.0.md"
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. 更新 transportTo 示例
    content = content.replace(
        '"transportTo": "high_speed_rail"',
        '"transportTo": "high_speed_rail"  // high_speed_rail / normal_train / flight / bus / auto'
    )
    
    # 2. 更新 prefer 参数示例
    content = content.replace(
        '"prefer": ["high_speed_rail"],',
        '"prefer": ["high_speed_rail"],     // 可选：high_speed_rail / normal_train / flight / bus'
    )
    
    # 3. 更新响应示例中的 type
    old_response = """{
        "type": "high_speed_rail",
        "trainNumber": "G6113","""
    
    new_response = """{
        "type": "high_speed_rail",       // high_speed_rail / normal_train / flight / bus
        "trainNumber": "G6113","""
    
    if old_response in content:
        content = content.replace(old_response, new_response)
    
    # 4. 添加普速火车和大巴的响应示例
    # 在高铁示例后添加
    add_after = """        "seatTypes": ["二等座", "一等座", "商务座"],
        "seatPrices": {"二等座": 314, "一等座": 498, "商务座": 998}
      },"""
    
    if "normal_train" not in content:
        additional_examples = """
      {
        "type": "normal_train",
        "trainNumber": "Z1",
        "departTime": "18:20",
        "arriveTime": "次日 08:15",
        "durationMinutes": 835,
        "departureStation": "北京西站",
        "arrivalStation": "长沙站",
        "seatTypes": ["硬座", "硬卧", "软卧"],
        "seatPrices": {"硬座": 156, "硬卧": 280, "软卧": 450},
        "isOvernight": true
      },
      {
        "type": "bus",
        "departTime": "09:00",
        "arriveTime": "次日 06:00",
        "durationMinutes": 1260,
        "departureStation": "北京赵公口客运站",
        "arrivalStation": "长沙汽车东站",
        "seatTypes": ["普通座", "商务座"],
        "seatPrices": {"普通座": 380, "商务座": 580},
        "isOvernight": true
      }"""
        
        content = content.replace(add_after, add_after + additional_examples)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("✅ API 接口设计规格书已更新")

def update_database_docs():
    """更新数据库设计规格书"""
    filepath = r"F:\WorkBuddy\2026-06-18-00-31-06\数据库设计规格书_v1.0.0.md"
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. 更新 transport_info JSONB 示例
    old_transport = """```json
{
  "type": "high_speed_rail",
  "departureTime": "16:45","""
    
    new_transport = """```json
{
  "type": "high_speed_rail",       // high_speed_rail / normal_train / flight / bus
  "departureTime": "16:45","""
    
    if old_transport in content:
        content = content.replace(old_transport, new_transport)
    
    # 2. 添加普速火车和大巴的 transport_info 示例
    if "normal_train" not in content:
        add_after = """  "ticketPrices": {"二等座": 314, "一等座": 498},
  "note": "信息仅供参考，请及时到 12306 订票"
}"""
        
        additional_example = """  "ticketPrices": {"二等座": 314, "一等座": 498},
  "note": "信息仅供参考，请及时到 12306 订票"
}

// 普速火车示例
{
  "type": "normal_train",
  "departureTime": "18:20",
  "arrivalTime": "次日 08:15",
  "durationMinutes": 835,
  "departureStation": "北京西站",
  "arrivalStation": "长沙站",
  "trainNumber": "Z1",
  "seatTypes": ["硬座", "硬卧", "软卧"],
  "ticketPrices": {"硬座": 156, "硬卧": 280, "软卧": 450},
  "isOvernight": true,
  "note": "隔夜车次，含卧铺"
}

// 长途大巴示例
{
  "type": "bus",
  "departureTime": "09:00",
  "arrivalTime": "次日 06:00",
  "durationMinutes": 1260,
  "departureStation": "北京赵公口客运站",
  "arrivalStation": "长沙汽车东站",
  "seatTypes": ["普通座", "商务座"],
  "ticketPrices": {"普通座": 380, "商务座": 580},
  "isOvernight": true,
  "note": "隔夜班次，建议准备颈枕"
}"""
        
        content = content.replace(add_after, additional_example)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("✅ 数据库设计规格书已更新")

def update_engine_docs():
    """更新 Trip_Lifecycle 引擎算法设计"""
    filepath = r"F:\WorkBuddy\2026-06-18-00-31-06\Trip_Lifecycle_引擎算法设计.md"
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. 更新 TransportType 定义
    content = content.replace(
        'transportTo?: TransportType;    // "high_speed_rail" | "flight"',
        'transportTo?: TransportType;    // "high_speed_rail" | "normal_train" | "flight" | "bus"'
    )
    
    # 2. 更新缓冲时间逻辑
    old_buffer = """  2. 计算缓冲时间 buffer
     如果 transportType == "high_speed_rail":
      bufferMinutes = 90   // 提前 1.5 小时
     否则如果 transportType == "flight":
      bufferMinutes = 120  // 提前 2 小时"""
    
    new_buffer = """  2. 计算缓冲时间 buffer
     如果 transportType == "flight":
      bufferMinutes = 120   // 提前 2 小时
     否则如果 transportType == "bus":
      bufferMinutes = 60    // 提前 1 小时
     否则:  // high_speed_rail 或 normal_train
      bufferMinutes = 90    // 提前 1.5 小时"""
    
    if old_buffer in content:
        content = content.replace(old_buffer, new_buffer)
        print("✅ 引擎算法设计 - 缓冲时间逻辑已更新")
    else:
        print("⚠️ 引擎算法设计 - 未找到缓冲时间逻辑，手动检查 needed")
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

def update_test_cases():
    """更新测试用例文档 - 添加 normal_train 和 bus 的测试用例"""
    filepath = r"F:\WorkBuddy\2026-06-18-00-31-06\测试用例文档_完整版_v1.0.0.md"
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 在合适的章节添加 normal_train 和 bus 的测试用例
    # 这里简单添加一个章节说明需要补充的测试点
    if "普速火车" not in content and "normal_train" not in content:
        test_addition = """

---

## 附录：待补充测试用例（normal_train & bus）

### 大交通类型扩展测试点

#### P0：普速火车（normal_train）
- [ ] 普速火车车次推荐（含卧铺）
- [ ] 隔夜车次处理（日期跨越）
- [ ] 硬座/硬卧/软卧价格展示
- [ ] 普速火车缓冲时间（90分钟）
- [ ] 普速火车展示格式（🚃 icon）

#### P1：长途大巴（bus）
- [ ] 大巴班次推荐
- [ ] 隔夜班次处理（日期跨越）
- [ ] 大巴缓冲时间（60分钟）
- [ ] 大巴展示格式（🚌 icon）

---
"""
        
        content += test_addition
        print("✅ 测试用例文档 - 已添加待补充测试点")
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == "__main__":
    print("开始批量更新文档...")
    print("=" * 60)
    
    try:
        update_frontend_specs()
    except Exception as e:
        print(f"❌ 前端交互设计规格书更新失败: {e}")
    
    print("-" * 60)
    
    try:
        update_api_docs()
    except Exception as e:
        print(f"❌ API 接口设计规格书更新失败: {e}")
    
    print("-" * 60)
    
    try:
        update_database_docs()
    except Exception as e:
        print(f"❌ 数据库设计规格书更新失败: {e}")
    
    print("-" * 60)
    
    try:
        update_engine_docs()
    except Exception as e:
        print(f"❌ 引擎算法设计更新失败: {e}")
    
    print("-" * 60)
    
    try:
        update_test_cases()
    except Exception as e:
        print(f"❌ 测试用例文档更新失败: {e}")
    
    print("=" * 60)
    print("文档更新完成！请手动验证更新结果。")
