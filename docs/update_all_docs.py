# -*- coding: utf-8 -*-
"""
批量更新所有文档：纳入普速火车（P0）、P1纳入大巴
"""
import os
import re

WORK_DIR = r"F:\WorkBuddy\2026-06-18-00-31-06"

def update_file(filepath, replacements):
    """批量替换文件中的文本"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_len = len(content)
    for old, new in replacements:
        content = content.replace(old, new)
    
    if len(content) != original_len:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return True, f"已更新: {os.path.basename(filepath)}"
    return False, f"无变化: {os.path.basename(filepath)}"

# ========== 1. 城市知识库数据规范 =========
# 已完成（normal_train + bus 类型已添加）

# ========== 2. SRS =========
# 已完成（M02-F03、DestinationConfig、中转日算法，共3处）

# ========== 3. 前端交互设计规格书 =========
file_fe = os.path.join(WORK_DIR, "前端交互设计规格书_v1.0.0.md")
replacements_fe = [
    # 免责声明：3处
    ('⚠️ 车次信息仅供参考，请尽快到 12306 订票',
     '⚠️ 车次/航班/大巴信息仅供参考，请尽快到 12306 / 航旅纵横 / 携程 / 飞猪 订票'),
    ('⚠️ 车次信息仅供参考，余票动态变化，',
     '⚠️ 车次/航班/大巴信息仅供参考，余票/班次动态变化，'),
    ('⚠️ 车次信息仅供参考，请尽快到 12306 / 携程 / 飞猪 订票',
     '⚠️ 车次/航班/大巴信息仅供参考，请尽快到 12306 / 航旅纵横 / 携程 / 飞猪 订票'),
]
ok, msg = update_file(file_fe, replacements_fe)
print(msg)

# ========== 4. API接口设计规格书 =========
file_api = os.path.join(WORK_DIR, "API接口设计规格书_v1.0.0.md")
replacements_api = [
    # /transport/search 接口：增加 type 参数说明
    ('"type": "high_speed_rail" | "flight"',
     '"type": "high_speed_rail" | "normal_train" | "flight" | "bus"'),
    # MVP 阶段说明
    ('MVP 不调实时 API，展示静态经验推荐并标注免责声明',
     'MVP 不调实时 API（normal_train/bus P1），展示静态经验推荐并标注免责声明'),
]
ok, msg = update_file(file_api, replacements_api)
print(msg)

# ========== 5. 数据库设计规格书 =========
file_db = os.path.join(WORK_DIR, "数据库设计规格书_v1.0.0.md")
replacements_db = [
    # day_plans.transport_info 字段说明
    ('"type": "high_speed_rail" | "flight"',
     '"type": "high_speed_rail" | "normal_train" | "flight" | "bus"'),
]
ok, msg = update_file(file_db, replacements_db)
print(msg)

# ========== 6. Trip_Lifecycle 引擎算法设计 =========
file_engine = os.path.join(WORK_DIR, "Trip_Lifecycle_引擎算法设计.md")
replacements_engine = [
    # transferType 判断
    ('transferType == "high_speed_rail" | "flight"',
     'transferType == "high_speed_rail" | "normal_train" | "flight" | "bus"'),
    # bufferTime 逻辑
    ('bufferTime = (transferType == "flight") ? 120 : 90',
     'bufferTime = (transferType == "flight") ? 120 : (transferType == "bus") ? 60 : 90'),
    # DestinationConfig.transportTo 枚举
    ('transportTo: "high_speed_rail" | "flight" | "auto"',
     'transportTo: "high_speed_rail" | "normal_train" | "flight" | "bus" | "auto"'),
]
ok, msg = update_file(file_engine, replacements_engine)
print(msg)

# ========== 7. 任务分解_WBS =========
file_wbs = os.path.join(WORK_DIR, "任务分解_WBS_v1.0.0.md")
replacements_wbs = [
    # API-015 描述更新
    ('查询大交通方案（高铁/航班）', '查询大交通方案（高铁/普速火车/航班/大巴）'),
]
ok, msg = update_file(file_wbs, replacements_wbs)
print(msg)

# ========== 8. MVP验收标准文档 =========
file_mvp = os.path.join(WORK_DIR, "MVP验收标准文档_v1.0.0.md")
replacements_mvp = [
    ('大交通 | ✅ 静态经验推荐 + 免责声明 | ❌ 实时车次/航班查询',
     '大交通 | ✅ 静态经验推荐（高铁/普速火车P0/航班/大巴P1）+ 免责声明 | ❌ 实时车次/航班/大巴查询'),
]
ok, msg = update_file(file_mvp, replacements_mvp)
print(msg)

print("\n===== 全部文档更新完成 =====")
