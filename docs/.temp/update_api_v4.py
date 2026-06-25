#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
更新 API 接口设计规格书中的响应示例，添加 normal_train 和 bus 选项
"""

filepath = r"F:\WorkBuddy\2026-06-18-00-31-06\API接口设计规格书_v1.0.0.md"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 在 high_speed_rail 选项后添加 normal_train 和 bus 选项
old_text = '        "note": "⚠️ 车次信息仅供参考，余票动态变化，请尽快到 12306 / 携程 / 飞猪订票"\n      }\n    ],'

new_text = '        "note": "⚠️ 车次信息仅供参考，余票动态变化，请尽快到 12306 / 携程 / 飞猪订票"\n      },\n      {\n        "type": "normal_train",\n        "trainNumber": "Z1",\n        "departTime": "18:20",\n        "arriveTime": "次日 08:15",\n        "durationMinutes": 835,\n        "pricePerPerson": {"硬座": 156, "硬卧": 280, "软卧": 450},\n        "availableSeats": {\n          "硬座": 120,\n          "硬卧": 30,\n          "软卧": 10\n        },\n        "departureStation": "北京西站",\n        "arrivalStation": "长沙站",\n        "isOvernight": true,\n        "note": "⚠️ 隔夜车次，含卧铺。信息仅供参考，请及时订票"\n      },\n      {\n        "type": "bus",\n        "departTime": "09:00",\n        "arriveTime": "次日 06:00",\n        "durationMinutes": 1260,\n        "pricePerPerson": {"普通座": 380, "商务座": 580},\n        "availableSeats": {\n          "普通座": 35,\n          "商务座": 15\n        },\n        "departureStation": "北京赵公口客运站",\n        "arrivalStation": "长沙汽车东站",\n        "isOvernight": true,\n        "note": "⚠️ 隔夜班次，建议准备颈枕。信息仅供参考，请及时订票"\n      }\n    ],'

if old_text in content:
    content = content.replace(old_text, new_text)
    print("[SUCCESS] API docs response example updated")
else:
    print("[WARNING] Old text not found, checking alternatives...")
    # Try to find the exact text
    if '"note": "⚠️ 车次信息仅供参考' in content:
        print("  Found note field but context mismatch")
        # Print surrounding text for debugging
        idx = content.find('"note": "⚠️ 车次信息仅供参考')
        print(f"  Position: {idx}")
        print(f"  Context: ...{content[idx-50:idx+100]}...")
    else:
        print("  Note field not found")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("[DONE] Script completed")
