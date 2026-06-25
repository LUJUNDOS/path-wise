#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
更新 API 接口设计规格书中的响应示例，添加 normal_train 和 bus 选项
"""

import re

filepath = r"F:\WorkBuddy\2026-06-18-00-31-06\API接口设计规格书_v1.0.0.md"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 在 high_speed_rail 选项后添加 normal_train 和 bus 选项
# 找到 high_speed_rail 选项的结束位置（], 之前）

old_option = """        "note": "⚠️ 车次信息仅供参考，余票动态变化，请尽快到 12306 / 携程 / 飞猪订票"
      }
    ],"""

new_options = """        "note": "⚠️ 车次信息仅供参考，余票动态变化，请尽快到 12306 / 携程 / 飞猪订票"
      },
      {
        "type": "normal_train",
        "trainNumber": "Z1",
        "departTime": "18:20",
        "arriveTime": "次日 08:15",
        "durationMinutes": 835,
        "pricePerPerson": {"硬座": 156, "硬卧": 280, "软卧": 450},
        "availableSeats": {
          "硬座": 120,
          "硬卧": 30,
          "软卧": 10
        },
        "departureStation": "北京西站",
        "arrivalStation": "长沙站",
        "isOvernight": true,
        "note": "⚠️ 隔夜车次，含卧铺。信息仅供参考，请及时订票"
      },
      {
        "type": "bus",
        "departTime": "09:00",
        "arriveTime": "次日 06:00",
        "durationMinutes": 1260,
        "pricePerPerson": {"普通座": 380, "商务座": 580},
        "availableSeats": {
          "普通座": 35,
          "商务座": 15
        },
        "departureStation": "北京赵公口客运站",
        "arrivalStation": "长沙汽车东站",
        "isOvernight": true,
        "note": "⚠️ 隔夜班次，建议准备颈枕。信息仅供参考，请及时订票"
      }
    ],"""

if old_option in content:
    content = content.replace(old_option, new_options)
    print("✅ API 文档响应示例已更新（添加了 normal_train 和 bus 选项）")
else:
    print("⚠️ 未找到匹配的旧文本，手动检查 needed")
    # 尝试查找类似文本
    if '"note": "⚠️ 车次信息仅供参考' in content:
        print("   找到 note 字段，但上下文不匹配")
    else:
        print("   未找到 note 字段")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("\n完成！")
