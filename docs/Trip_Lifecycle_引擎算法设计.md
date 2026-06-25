# Trip Lifecycle 引擎算法设计文档

> **文档版本**：v1.0.0
> **日期**：2026-06-18
> **对应 SRS**：旅游攻略生成平台\_SRS.md v1.1.0
> **作者**：Buddy 🏗️

---

## 目录

1. [引擎整体架构](#1-引擎整体架构)
2. [核心数据结构](#2-核心数据结构)
3. [算法一：时间轴初始化](#3-算法一时间轴初始化)
4. [算法二：候选池生成与过滤](#4-算法二候选池生成与过滤)
5. [算法三：时间轴填充（贪心+回溯）](#5-算法三时间轴填充)
6. [算法四：中转日特殊逻辑](#6-算法四中转日特殊逻辑)
7. [算法五：B 方案注入](#7-算法五b-方案注入)
8. [完整执行流程伪代码](#8-完整执行流程伪代码)
9. [算法复杂度分析](#9-算法复杂度分析)
10. [边界情况处理](#10-边界情况处理)

---

## 1. 引擎整体架构

### 1.1 处理流程总览

```
用户输入
   │
   ▼
┌─────────────────────────────────────────────┐
│  Step 1: 时间轴初始化                       │
│  - 解析 destinations 数组                   │
│  - 确定每个 Day 的类型（移动日/深度游/中转）│
│  - 计算每日可用时间窗口                      │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Step 2: 候选池生成（按城市循环）           │
│  - 加载城市知识库 POI                       │
│  - 多维度过滤（人群/营业时间/距离/预算）     │
│  - 输出每个城市的候选活动列表                │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Step 3: 时间轴填充（核心算法）             │
│  - 按天循环，从候选池选最优活动             │
│  - 贪心选择 + 回溯换项                      │
│  - 体力消耗累积检查                          │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Step 4: 中转日特殊处理                     │
│  - 强制过滤 HIGH 体力活动                   │
│  - 注入「前往枢纽」时间块                    │
│  - 写入城市交接提示                          │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Step 5: B 方案注入 + 输出                  │
│  - 每个主选活动挂备选列表                    │
│  - 生成最终 Timeline JSON                    │
│  - SSE 流式返回前端                         │
└─────────────────────────────────────────────┘
```

### 1.2 引擎入口函数签名

```typescript
/**
 * Trip Lifecycle 引擎主入口
 */
async function generateTripLifecycle(params: TripRequest): Promise<TimelineDay[]> {
  // Step 1
  const timeline = initializeTimeline(params);
  // Step 2
  const candidatePools = await buildCandidatePools(params);
  // Step 3 + Step 4
  const filledTimeline = fillTimeline(timeline, candidatePools, params);
  // Step 5
  const finalTimeline = injectBackupPlans(filledTimeline);
  return finalTimeline;
}
```

---

## 2. 核心数据结构

### 2.1 输入：`TripRequest`

```typescript
interface TripRequest {
  departure: string; // "北京"
  destinations: DestinationConfig[];
  startDate: string; // "2026-07-01"
  preferences: UserPreferences;
}

interface DestinationConfig {
  cityName: string; // "changsha"
  cityDisplayName: string; // "长沙"
  days: number; // 5
  transportTo?: TransportType; // "high_speed_rail" | "normal_train" | "flight" | "bus"
}

interface UserPreferences {
  budget: { total: number; perDay: number };
  pace: 'relaxed' | 'balanced' | 'intensive';
  members: MemberProfile[];
  accommodation: AccommodationPref;
  dining: DiningPref;
}

interface MemberProfile {
  type: 'adult' | 'child' | 'infant' | 'elder';
  count: number;
}
```

### 2.2 输出：`TimelineDay`

```typescript
interface TimelineDay {
  dayIndex: number; // 1, 2, 3...
  date: string; // "2026-07-01"
  dayType: DayType; // "MOBILE" | "DEEP_PLAY" | "TRANSFER" | "ARRIVAL"
  city: string;
  availableWindow: TimeWindow; // 当天可用时间窗口
  items: TimelineItem[]; // 当天安排的活动列表
  transferInfo?: TransferInfo; // 中转日专用
}

interface TimelineItem {
  id: string;
  poi: POI;
  startTime: string; // "14:00"
  endTime: string; // "16:00"
  duration: number; // 分钟数
  energyLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  alternatives: POI[]; // B 方案候选
  bookingInfo?: BookingInfo; // 预约/购票信息
}

interface TimeWindow {
  start: string; // "14:00"
  end: string; // "22:00"
  totalMinutes: number;
}
```

### 2.3 城市知识库：`POI`

```typescript
interface POI {
  id: string;
  name: string;
  city: string;
  category: POICategory;
  location: { lat: number; lng: number };
  duration: number; // 建议游玩分钟数
  energyLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  bestTimeSlot: ('morning' | 'afternoon' | 'evening')[];
  suitableFor: MemberType[]; // 适合的人群
  openingHours: { open: string; close: string; closedOn: string[] };
  priceRange: { min: number; max: number };
  bookingRequired: boolean;
  bookingUrl?: string;
  deepLink?: DeepLink; // 跳转链接
}
```

---

## 3. 算法一：时间轴初始化

### 3.1 算法目标

根据 `destinations` 数组，生成完整的时间轴框架，确定每个 Day 的类型和可用时间窗口。

### 3.2 伪代码

```
函数: initializeTimeline(params: TripRequest) -> TimelineDay[]

输入:
  departure: 出发城市
  destinations: 目的地数组（N 个城市）
  startDate: 出发日期

输出:
  timeline: 长度为总天数的 TimelineDay 数组

步骤:
  1. 计算总天数 totalDays
     totalDays = sum(destinations[].days)
     （注：如果出发日算 Day 1，则总天数 = 各城市天数之和）

  2. 初始化一个空数组 timeline

  3. 设置 currentDate = startDate
    设置 prevCity = departure

  4. 对 destinations 数组进行循环，索引 i 从 0 到 N-1:
      city = destinations[i]
      isFirstCity = (i == 0)
      hasNextCity = (i < N - 1)

      如果 isFirstCity:
        // 第一个城市：Day 1 是移动日
        timeline 追加一个 Day:
          dayType = "MOBILE"
          city = city.cityName
          availableWindow = 计算移动日时间窗口(params)

      如果 hasNextCity:
        // 不是最后一个城市：倒数第二天是中转日
        lastDayIndex = timeline.length + city.days - 1
        // 前 city.days-1 天是深度游
        循环 j 从 0 到 city.days - 2:
          timeline 追加一个 Day:
            dayType = "DEEP_PLAY"
            city = city.cityName
            availableWindow = { start: "09:00", end: "22:00" }

        // 最后一天是中转日
        timeline 追加一个 Day:
          dayType = "TRANSFER"
          city = city.cityName
          availableWindow = 计算中转日时间窗口(city, destinations[i+1])
      else:
        // 最后一个城市：所有天都是深度游（或返程日）
        循环 j 从 0 到 city.days - 1:
          // 若用户勾选「预定返程」且为最后一天 → 返程日
          如果 needsReturnTransport == true 且 j == city.days - 1:
            timeline 追加一个 Day:
              dayType = "TRANSFER"  // 或 "RETURN"，前端映射为 transit_return
              city = city.cityName
              availableWindow = 计算返程日时间窗口（末站城市 → 出发城市，returnTransportPref）
              注入返程大交通到当日 timeline
          否则:
            timeline 追加一个 Day:
              dayType = "DEEP_PLAY"
              city = city.cityName
              availableWindow = { start: "09:00", end: "22:00" }

      currentDate = currentDate + city.days 天

  5. 返回 timeline
```

### 3.3 中转日时间窗口计算

```
函数: computeTransferDayWindow(currentCity, nextCity, transportType) -> TimeWindow

步骤:
  1. 获取大交通出发时间 departureTime
     （从用户请求中获取，或 AI 推荐一个合理时间）

  2. 计算缓冲时间 buffer
     如果 transportType == "flight":
      bufferMinutes = 120   // 提前 2 小时
     否则如果 transportType == "bus":
      bufferMinutes = 60    // 提前 1 小时
     否则:  // high_speed_rail 或 normal_train
      bufferMinutes = 90    // 提前 1.5 小时

  3. 获取从市区到枢纽的交通时间 transitToHubMinutes
     （调用高德路线规划 API，取市中心到高铁站/机场的时间）

  4. 计算最晚从市区出发时间 latestDepartureFromCity
     latestDeparture = departureTime - bufferMinutes - transitToHubMinutes

  5. 返回时间窗口
     return {
       start: "09:00",
       end: latestDeparture 的格式化为 "HH:MM",
       totalMinutes: 从 09:00 到 latestDeparture 的分钟数
     }

  6. 透明化展示：在 TimeWindow 中附加 explanation 字段
     explanation = `
       大交通出发时间：${departureTime}
       建议提前到达枢纽：${bufferMinutes} 分钟
       市区到枢纽交通时间：约 ${transitToHubMinutes} 分钟
       → 最晚 ${latestDeparture} 从市区出发
     `
```

### 3.3.1 返程日时间窗口计算

```
函数: computeReturnDayWindow(lastCity, departureCity, returnTransportPref) -> TimeWindow

前置条件:
  - needsReturnTransport == true（用户勾选预定返程）
  - lastCity 为目的地列表的最后一个城市

步骤:
  1. 确定返程日期 returnDate
     returnDate = 出发日期 + 所有城市停留天数之和

  2. 确定返程交通类型 transportType
     如果 returnTransportPref == "auto":
       transportType = 与去程相同的交通类型（或智能推荐）
     否则:
       transportType = returnTransportPref

  3. 查询返程大交通
     调用城市知识库 intercity_transport 数据
     从 lastCity → departureCity 方向查询

  4. 计算缓冲时间 buffer（同 §3.3 中转日逻辑）
     flight → 120min
     bus → 60min
     其他（high_speed_rail / normal_train）→ 90min

  5. 计算最晚离开市区时间（同 §3.3 中转日逻辑）

  6. 返回时间窗口 + 返程交通信息注入到当日 timeline[0]

  7. 透明化展示 explanation：
     explanation = `
       返程交通：${transportTypeLabel} ${transportNumber}
       出发时间：${departureTime}
       建议提前到达枢纽：${bufferMinutes} 分钟
       → 最晚 ${latestDeparture} 从市区出发
     `
```

### 3.4 示例：三城市行程的时间轴

```
输入：北京 → 长沙（3天） → 南昌（2天） → 广州（3天）
总天数 = 3 + 2 + 3 = 8 天

输出时间轴：
  Day 1: MOBILE      (北京 → 长沙，下午到达)
  Day 2: DEEP_PLAY   (长沙)
  Day 3: TRANSFER    (长沙 → 南昌，下午出发)
  Day 4: ARRIVAL     (南昌，到达后晚上)
  Day 5: DEEP_PLAY   (南昌)
  Day 6: TRANSFER    (南昌 → 广州，下午出发)
  Day 7: ARRIVAL     (广州，到达后晚上)
  Day 8: DEEP_PLAY   (广州)
```

> **注意**：上面的示例中，每个城市的 `days` 字段实际上应该包含「到达日」和「中转日」。更合理的理解是：
>
> - `days: 3` 表示在该城市 **深度游玩 3 天**（不含移动日）
> - 移动日/中转日由引擎自动插入
>
> 修正后的计算：`totalDays = N个城市的中转日(N-1) + 出发日(1) + sum(destinations.days)`

---

## 4. 算法二：候选池生成与过滤

### 4.1 算法目标

对每个城市，从知识库加载 POI，然后根据用户偏好和约束进行多维度过滤，生成「可用候选池」。

### 4.2 伪代码

```
函数: buildCandidatePools(params: TripRequest) -> Map<string, POI[]>

步骤:
  1. 初始化一个空 Map: candidatePools

  2. 对 params.destinations 中的每个城市 dest:
      cityName = dest.cityName

      // 2.1 从城市知识库加载所有 POI
      allPOIs = 城市知识库.query(cityName)

      // 2.2 多维度过滤
      filtered = allPOIs
        .filter(poi -> 营业时间过滤(poi, dest))
        .filter(poi -> 人群匹配过滤(poi, params.preferences.members))
        .filter(poi -> 预算过滤(poi, params.preferences.budget))
        .filter(poi -> 预约状态过滤(poi))

      // 2.3 按类别分组，便于后续填充时均衡选择
      grouped = groupByCategory(filtered)

      // 2.4 存入 candidatePools
      candidatePools.set(cityName, grouped)

  3. 返回 candidatePools
```

### 4.3 过滤维度详解

#### 4.3.1 营业时间过滤

```
函数: 营业时间过滤(poi, date) -> boolean

  如果 poi.openingHours.closedOn 包含 date 的星期几:
    return false  // 闭馆日，过滤掉

  如果 poi.openingHours.open == "00:00" && poi.openingHours.close == "00:00":
    return true   // 全天开放（如户外景点）

  return true
```

#### 4.3.2 人群匹配过滤

```
函数: 人群匹配过滤(poi, members: MemberProfile[]) -> boolean

  遍历 members:
    如果 member.type == "elder" 或 "child":
      如果 poi.energyLevel == "HIGH":
        如果 poi 没有无障碍设施标签:
          return false  // 带老人/孩子，过滤掉高强度景点

    如果 member.type == "infant":
      如果 poi.category == "夜店" 或 "酒吧":
        return false

  return true
```

#### 4.3.3 预算过滤

```
函数: 预算过滤(poi, budget) -> boolean

  // 单人预算检查
  avgPrice = (poi.priceRange.min + poi.priceRange.max) / 2
  return avgPrice <= budget.perDay * 0.3  // 单个景点不超过当日预算 30%
```

---

## 5. 算法三：时间轴填充

### 5.1 算法目标

将候选池中的活动填入时间轴，核心挑战是在多个约束下找到最优排列。

### 5.2 评分函数

每个候选 POI 对某个时间槽的「适合度」由评分函数决定：

```
函数: scorePOI(poi, context: FillContext) -> number

  context 包含:
    - currentTime: 当前时间（从几点开始排）
    - prevPOI: 上一个安排的 POI（如果有）
    - dayType: 当天类型
    - energyUsed: 当天已消耗体力
    - userPreferences: 用户偏好

  评分项（满分 100）:
    1. 距离得分 (0-30):
       distance = 计算 poi 到 prevPOI 的距离（米）
       如果 prevPOI 不存在:
         distanceScore = 15  // 第一天，距离不是主要因素
       否则如果 distance < 1000:
         distanceScore = 30
       否则如果 distance < 3000:
         distanceScore = 20
       否则:
         distanceScore = 5

    2. 时间段匹配得分 (0-25):
       当前时间段 = 判断 currentTime 是上午/下午/晚上
       如果 currentTime 在 poi.bestTimeSlot 里:
         timeScore = 25
       否则:
         timeScore = 5

    3. 用户偏好匹配得分 (0-25):
       preferenceScore = 0
       遍历 userPreferences.categories:
        如果 poi.category == category:
         preferenceScore += 25 / userPreferences.categories.length

    4. 体力消耗均衡得分 (0-20):
       如果 poi.energyLevel == "LOW":
         energyScore = 20
       否则如果 poi.energyLevel == "MEDIUM":
         energyScore = 10
       否则:  // HIGH
         energyScore = 0

  totalScore = distanceScore + timeScore + preferenceScore + energyScore
  return totalScore
```

### 5.3 贪心 + 回溯填充算法

```
函数: fillTimeline(timeline, candidatePools, params) -> TimelineDay[]

步骤:
  1. 对 timeline 中的每一天 day 进行循环:

     候选池 = candidatePools.get(day.city)
     currentTime = day.availableWindow.start
     energyUsed = 0  // 当天已消耗体力（LOW=1, MEDIUM=2, HIGH=3）

     循环（当 currentTime < day.availableWindow.end）:

       // 3.1 从候选池中找到得分最高的 POI
       candidates = 候选池
         .filter(poi -> poi.duration + 交通时间 <= day.availableWindow.end - currentTime)
         .filter(poi -> energyUsed + energyOf(poi) <= MAX_ENERGY_PER_DAY)
         .map(poi -> { poi, score: scorePOI(poi, context) })
         .sort((a, b) -> b.score - a.score)

       如果 candidates 为空:
         // 回溯：移除上一个安排，换一个更短的活动
         如果 day.items 不为空:
           lastItem = day.items.pop()
           将 lastItem.poi 标记为「本轮不合适」
           currentTime = lastItem.startTime  // 回退到上一个开始时间
           energyUsed -= energyOf(lastItem.poi)
           继续循环（重试）
         否则:
           break  // 真的塞不下了

       // 3.2 选择得分最高的 POI
       selected = candidates[0].poi

       // 3.3 计算开始时间（考虑交通时间）
       如果 day.items 不为空:
         prevItem = day.items[day.items.length - 1]
         transitTime = 计算交通时间(prevItem.poi, selected)
         startTime = currentTime + transitTime
       否则:
         startTime = currentTime

       endTime = startTime + selected.duration

       // 3.4 检查是否超出时间窗口
       如果 endTime > day.availableWindow.end:
         // 回溯
         将 selected 标记为「本轮不合适」
         继续循环（重试）

       // 3.5 填入时间轴
       item = {
         poi: selected,
         startTime: format(startTime),
         endTime: format(endTime),
         duration: selected.duration,
         energyLevel: selected.energyLevel,
         alternatives: []  // Step 5 注入
       }
       day.items.push(item)

       // 3.6 更新状态
       currentTime = endTime
       energyUsed += energyOf(selected)

       // 3.7 如果快到晚餐时间，插入「用餐」时间块
       如果 isNearMealTime(currentTime):
         currentTime += 60  // 预留 1 小时用餐
```

### 5.4 体力消耗模型

```
常量:
  MAX_ENERGY_PER_DAY = 8  // 每天最大体力值
  ENERGY_VALUE = {
    "LOW": 1,
    "MEDIUM": 2,
    "HIGH": 4  // HIGH 消耗加倍，因为会影响后续活动
  }

函数: energyOf(poi) -> number
  return ENERGY_VALUE[poi.energyLevel]
```

---

## 6. 算法四：中转日特殊逻辑

### 6.1 中转日处理流程

中转日是最复杂的一天，需要在「游玩」和「赶路」之间找到平衡。

```
函数: handleTransferDay(day: TimelineDay, currentCity, nextCity, transportInfo)

步骤:
  1. 获取中转日时间窗口 window = day.availableWindow
     最晚出发时间 = window.end（由算法一自动计算）

  2. 从候选池获取当前城市的 POI
     但进行额外过滤：
      过滤掉 energyLevel == "HIGH" 的所有 POI
      优先选择 location 靠近市中心的 POI（便于去枢纽）

  3. 调用通用填充算法（算法三），但传入特殊参数：
     context = {
       ...defaultContext,
       maxEndTime: 最晚出发时间 - 60,  // 预留 1 小时缓冲
       forbidHighEnergy: true,
       preferCentralLocation: true
     }

  4. 填充完成后，在最后追加「前往枢纽」时间块:
      day.items.push({
        type: "TRANSIT_TO_HUB",
        startTime: 最晚出发时间 - transitToHubMinutes,
        endTime: 最晚出发时间,
        description: `
          建议从 ${currentCity}市中心出发前往${枢纽名称}
          （${transitMode}约 ${transitToHubMinutes} 分钟）
        `,
        transitDetails: {
          from: "市中心",
          to: hubName,
          duration: transitToHubMinutes,
          mode: transitMode
        }
      })

  5. 在 day 对象中写入中转提示:
      day.transferInfo = {
        departCity: currentCity,
        arriveCity: nextCity,
        departTime: transportInfo.departTime,
        arriveTime: transportInfo.arriveTime,
        suggestion: `
          今天下午 ${transportInfo.departTime} 出发前往 ${nextCity}
          上午可以轻松游玩，推荐在市中心活动，便于前往车站
        `
      }

  6. 返回处理后的 day
```

### 6.2 中转日 AI 提示词示例

```
// 在生成攻略的 LLM prompt 中，中转日的系统提示：

你正在为用户的「中转日」生成攻略。
这一天用户将在 ${departCity} 和 ${arriveCity} 之间移动。

约束条件：
- 用户最晚 ${latestDepartureTime} 必须从市区出发前往 ${departHub}
- 绝对不要安排需要大量体力的活动（如爬山、长距离徒步）
- 推荐在市中心活动，便于前往交通枢纽
- 如果用户买的是下午/晚上出发的车次，上午可以正常安排游玩
- 在攻略中注明：「今天 ${departTime} 出发前往 ${arriveCity}，预计 ${arriveTime} 到达」

示例输出风格：
  "上午可以睡个懒觉，11点在五一广场附近吃个长沙米粉，
   下午在 IFS 附近逛逛，买点茶颜悦色伴手礼。
   15:30 从五一广场出发前往长沙南站（地铁2号线约45分钟），
   16:15 到达车站，乘坐 16:45 的高铁前往广州。"
```

---

## 7. 算法五：B 方案注入

### 7.1 目标

为每个主选活动提供一个或多个备选，当用户点击「换一个」时，前端可以立即切换。

### 7.2 伪代码

```
函数: injectBackupPlans(timeline: TimelineDay[]) -> TimelineDay[]

步骤:
  对 timeline 中的每一天 day:
    对 day.items 中的每个 item:

      // 1. 在同城市中找同类别、近距离的 POI
      alternatives = candidatePools.get(day.city)
        .filter(poi -> poi.category == item.poi.category)
        .filter(poi -> 距离(item.poi, poi) < 5000)  // 5km 内
        .filter(poi -> poi.id != item.poi.id)
        .sort((a, b) -> a.energyLevel - b.energyLevel)  // 优先低体力
        .slice(0, 3)  // 最多 3 个备选

      // 2. 如果同类别不够，加入不同类别但评分高的
      如果 alternatives.length < 2:
        extra = candidatePools.get(day.city)
          .filter(poi -> poi.id != item.poi.id)
          .filter(poi -> 距离(item.poi, poi) < 3000)
          .sort((a, b) -> scorePOI(b) - scorePOI(a))
          .slice(0, 2 - alternatives.length)
        alternatives.push(...extra)

      // 3. 注入到 item
      item.alternatives = alternatives
```

---

## 8. 完整执行流程伪代码

以下是引擎的完整主流程，整合上述所有算法：

```typescript
async function generateTripLifecycle(params: TripRequest): Promise<TimelineDay[]> {
  console.log('[TripLifecycle] 开始生成行程，参数:', params);

  // ========== Step 1: 时间轴初始化 ==========
  const timeline = initializeTimeline(params);
  console.log(`[TripLifecycle] 时间轴初始化完成，共 ${timeline.length} 天`);

  // ========== Step 2: 候选池生成 ==========
  const candidatePools = new Map<string, POI[]>();
  for (const dest of params.destinations) {
    const cityName = dest.cityName;
    console.log(`[TripLifecycle] 正在加载 ${cityName} 的候选 POI...`);

    // 2.1 从向量数据库搜索
    const allPOIs = await vectorDB.search({
      city: cityName,
      embedding: await embedText(`${cityName} 旅游景点 美食`),
      topK: 200
    });

    // 2.2 多维度过滤
    const filtered = allPOIs
      .filter(poi => isOpenOnDate(poi, params.startDate))
      .filter(poi => isSuitableForMembers(poi, params.preferences.members))
      .filter(poi => isWithinBudget(poi, params.preferences.budget))
      .filter(poi => !isFullyBooked(poi));

    candidatePools.set(cityName, filtered);
    console.log(`[TripLifecycle] ${cityName} 候选 POI: ${filtered.length} 个`);
  }

  // ========== Step 3: 时间轴填充 ==========
  for (let i = 0; i < timeline.length; i++) {
    const day = timeline[i];
    console.log(`[TripLifecycle] 正在填充 Day ${day.dayIndex} (${day.dayType})...`);

    if (day.dayType === 'TRANSFER') {
      // 中转日特殊处理
      const currentCityIndex = 找到当前城市在 destinations 中的索引;
      const nextCity = params.destinations[currentCityIndex + 1];
      timeline[i] = handleTransferDay(day, day.city, nextCity.cityName, {
        departTime: '16:45',  // 实际应从用户请求或大交通 API 获取
        arriveTime: '19:00',
        transportType: nextCity.transportTo
      });
    } else {
      // 普通填充
      const candidates = candidatePools.get(day.city) || [];
      timeline[i] = fillDayWithPOIs(day, candidates, params.preferences);
    }

    console.log(`[TripLifecycle] Day ${day.dayIndex} 填充完成，共 ${day.items.length} 个活动`);
  }

  // ========== Step 4: B 方案注入 ==========
  const finalTimeline = injectBackupPlans(timeline);
  console.log('[TripLifecycle] B 方案注入完成');

  // ========== Step 5: 返回结果 ==========
  return finalTimeline;
}
```

---

## 9. 算法复杂度分析

### 9.1 时间复杂度

| 算法               | 时间复杂度     | 说明                          |
| ------------------ | -------------- | ----------------------------- |
| 时间轴初始化       | O(N)           | N = 城市数量                  |
| 候选池生成         | O(C × P)       | C = 城市数，P = 每城市 POI 数 |
| 时间轴填充（贪心） | O(D × P_log_P) | D = 天数，P = 候选池大小      |
| 回溯（最坏情况）   | O(D × P²)      | 每次回溯需要重新排序          |
| B 方案注入         | O(D × I × P)   | I = 每天活动数                |

**实际场景估算**（以 3 城市、每城市 200 POI、共 8 天为例）：

- 候选池生成：3 × 200 = 600 次过滤操作
- 时间轴填充：8 × 200_log_200 ≈ 8 × 200 × 8 = 12800 次评分
- 总耗时估算（不含 LLM 调用）：< 1 秒

### 9.2 空间复杂度

| 数据结构       | 空间复杂度                            |
| -------------- | ------------------------------------- |
| candidatePools | O(C × P) ≈ 3 × 200 = 600 个 POI 对象  |
| timeline       | O(D × I) ≈ 8 × 8 = 64 个 TimelineItem |
| 评分缓存       | O(P) ≈ 200 个预计算评分               |

**结论**：算法本身不是性能瓶颈，性能瓶颈在 **LLM 调用** 和 **向量数据库查询**。

---

## 10. 边界情况处理

### 10.1 两个城市之间只有 1 天

```
场景：用户设置 北京 → 长沙（1天） → 广州

处理：
  - Day 1: MOBILE（北京 → 长沙，下午到达）
  - Day 2: TRANSFER（长沙 → 广州，上午/下午出发）
  - 不在长沙安排深度游玩，Day 1 到达后只推荐「附近轻松活动」

算法调整：
  如果 dest.days == 1:
    这一天直接标记为 TRANSFER
    不调用 fillDayWithPOIs，只注入「到达后晚餐推荐」
```

### 10.2 到达时间太晚（凌晨到达）

```
场景：用户坐夜班火车，凌晨 03:00 到达

处理：
  - 当天只安排「入住酒店 + 休息」
  - 游玩从第二天开始
  - 自动调整时间轴（后续每天顺延）

算法调整：
  如果 到达时间 > "22:00":
    currentDay.items = [{ type: "REST", description: "凌晨到达，建议直接入住休息" }]
    startIndex 从 1 开始（跳过当天）
```

### 10.3 连续两个中转日

```
场景：用户设置 北京 → 长沙（1天） → 广州（1天） → 深圳（2天）

处理：
  - 长沙只有 1 天 → 直接 TRANSFER
  - 广州只有 1 天 → 直接 TRANSFER
  - 算法自动衔接，不会重复安排

关键：在 initializeTimeline 时，正确标记 dayType
  - 如果 dest.days == 1 → 该城市只有 TRANSFER 日
  - 不创建 DEEP_PLAY 日
```

### 10.4 候选池为空（新城市，知识库未建设）

```
处理：
  1. 降级用高德 POI API 实时搜索
  2. 在攻略中标注：「该城市攻略由 AI 实时生成，建议核实」
  3. 引导用户贡献数据（UGC）

算法调整：
  如果 candidatePools.get(city).length == 0:
    pois = await gaodeAPI.searchPOI(city, { categories: [...], limit: 50 })
    candidatePools.set(city, pois)
```

### 10.5 用户修改了已生成的攻略

```
场景：用户对 AI 生成的攻略不满意，手动调整

处理：
  - 前端支持拖拽调整时间块
  - 调整后，调用增量校验接口：
    POST /api/timeline/validate
    body: { items: [...], constraints: {...} }
  - 返回：是否有冲突（时间重叠、闭馆、体力超限）

算法调整：
  不需要重新生成整个时间轴，只校验被修改的部分
```

---

## 11. 算法参数配置建议

以下是 MVP 阶段的推荐参数值：

```typescript
const ALGORITHM_CONFIG = {
  // 时间窗口
  DEFAULT_START_TIME: '09:00',
  DEFAULT_END_TIME: '22:00',
  TRANSFER_DAY_MAX_ACTIVITY_END: '14:00', // 中转日下午 2 点后不安排新活动

  // 体力模型
  MAX_ENERGY_PER_DAY: 8,
  ENERGY_VALUE: { LOW: 1, MEDIUM: 2, HIGH: 4 },

  // 距离约束
  MAX_DISTANCE_BETWEEN_POIS: 5000, // 5km，超过则扣分
  PREFERRED_DISTANCE: 2000, // 2km，最优距离

  // 中转日
  HSR_BUFFER_MINUTES: 90, // 高铁提前 1.5h
  NORMAL_TRAIN_BUFFER_MINUTES: 90, // 普速火车提前 1.5h
  FLIGHT_BUFFER_MINUTES: 120, // 飞机提前 2h
  BUS_BUFFER_MINUTES: 60, // 大巴提前 1h
  TRANSIT_TO_HUB_SAFETY_MARGIN: 60, // 到枢纽后预留 1h 缓冲

  // B 方案
  MAX_ALTERNATIVES: 3,
  ALT_MAX_DISTANCE: 5000,

  // 回溯
  MAX_BACKTRACK_STEPS: 5, // 最多回溯 5 次，避免无限循环
};
```

---

## 12. 后续优化方向

| 优化方向         | 说明                                         | 优先级 |
| ---------------- | -------------------------------------------- | ------ |
| **机器学习排序** | 用用户反馈数据训练排序模型，替代人工评分函数 | 阶段二 |
| **实时交通集成** | 接入实时路况，动态调整交通时间               | 阶段二 |
| **多人协同规划** | 支持多个用户一起规划，合并偏好               | 阶段三 |
| **天气感知**     | 接入天气预报，雨天自动调整户外/室内活动      | 阶段二 |
| **A/B 测试框架** | 对评分函数参数进行 A/B 测试，持续优化        | 阶段二 |

---

_文档结束 · 版本 v1.0.0_
