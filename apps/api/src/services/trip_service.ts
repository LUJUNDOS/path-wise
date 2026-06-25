/**
 * PATH-WISE · 攻略服务（MVP stub）
 * 职责：攻略生成编排、CRUD、校验冲突
 *
 * MVP 阶段：大部分接口返回 mock 数据，后续接入 LLM 适配器 + 高德 API
 */

import type {
  TripGenerateRequest,
  TripResponse,
  TripSummary,
  TripValidationResponse,
  DayUpdateRequest,
  ExportOptions,
  ExportResponse,
  TripRegenerateRequest,
  DayPlan,
  TimelineItem,
  AccommodationOption,
  HotelOption,
} from '@path-wise/shared';

/** MVP 内存存储：已生成的攻略（重启丢失，后续迁移到 Prisma） */
const tripStore = new Map<string, TripResponse>();

/**
 * 保存已生成的攻略到内存
 */
export function saveTrip(trip: TripResponse): void {
  tripStore.set(trip.tripId, trip);
}

// ─────────────────────────────────────────────
// 城市真实数据（MVP mock，后续接入高德 API + LLM）
// ─────────────────────────────────────────────

interface CityData {
  attractions: Array<{
    name: string;
    costCNY: number;
    durationMin: number;
    energy: 'LOW' | 'MEDIUM' | 'HIGH';
    bookingRequired: boolean;
    description: string;
  }>;
  dining: Array<{ name: string; costCNY: number; description: string }>;
  hotels: Array<{
    name: string;
    address: string;
    pricePerNight: number;
    reason: string;
    amenities: string[];
  }>;
  tips: string[];
}

const CITY_DATA: Record<string, CityData> = {
  北京: {
    attractions: [
      {
        name: '故宫博物院',
        costCNY: 60,
        durationMin: 240,
        energy: 'HIGH',
        bookingRequired: true,
        description: '世界最大的宫殿建筑群，明清两代皇宫',
      },
      {
        name: '颐和园',
        costCNY: 30,
        durationMin: 180,
        energy: 'MEDIUM',
        bookingRequired: false,
        description: '中国现存最大的皇家园林，昆明湖与万寿山交相辉映',
      },
      {
        name: '天坛公园',
        costCNY: 34,
        durationMin: 120,
        energy: 'LOW',
        bookingRequired: false,
        description: '明清皇帝祭天场所，回音壁奇观',
      },
      {
        name: '八达岭长城',
        costCNY: 40,
        durationMin: 240,
        energy: 'HIGH',
        bookingRequired: false,
        description: '世界文化遗产，万里长城精华段',
      },
      {
        name: '南锣鼓巷',
        costCNY: 0,
        durationMin: 90,
        energy: 'LOW',
        bookingRequired: false,
        description: '老北京胡同文化街区，文艺小店聚集',
      },
      {
        name: '798艺术区',
        costCNY: 0,
        durationMin: 120,
        energy: 'MEDIUM',
        bookingRequired: false,
        description: '工业遗址改造的当代艺术中心',
      },
    ],
    dining: [
      {
        name: '四季民福烤鸭店（故宫店）',
        costCNY: 120,
        description: '招牌烤鸭皮酥肉嫩，景观位可观故宫角楼',
      },
      { name: '东来顺饭庄', costCNY: 100, description: '百年老字号铜锅涮肉，手切羊肉鲜嫩' },
      { name: '护国寺小吃', costCNY: 30, description: '北京小吃集合：豌豆黄、驴打滚、豆汁焦圈' },
      { name: '局气（西单店）', costCNY: 80, description: '新派北京菜，蜂窝煤炒饭是招牌' },
    ],
    hotels: [
      {
        name: '北京王府井希尔顿酒店',
        address: '东城区王府井大街8号',
        pricePerNight: 1280,
        reason: '步行5分钟到故宫，行政酒廊俯瞰紫禁城',
        amenities: ['含早餐', '游泳池', '健身房', '免费WiFi'],
      },
      {
        name: '全季酒店（北京站前门店）',
        address: '东城区前门大街62号',
        pricePerNight: 450,
        reason: '地铁直达天安门、故宫，性价比高',
        amenities: ['含早餐', '免费WiFi', '洗衣服务'],
      },
      {
        name: '北京胡同里四合院民宿',
        address: '西城区什刹海后海北沿24号',
        pricePerNight: 680,
        reason: '住在老北京四合院，体验地道胡同生活',
        amenities: ['含早餐', '免费WiFi', '自行车租借'],
      },
    ],
    tips: [
      '故宫需提前7天在官网预约，周一闭馆',
      '长城建议早8点前出发避开人流高峰',
      '北京地铁覆盖主要景区，办一张交通卡更方便',
    ],
  },
  上海: {
    attractions: [
      {
        name: '外滩',
        costCNY: 0,
        durationMin: 60,
        energy: 'LOW',
        bookingRequired: false,
        description: '黄浦江畔万国建筑博览群，对岸陆家嘴天际线',
      },
      {
        name: '上海迪士尼乐园',
        costCNY: 475,
        durationMin: 480,
        energy: 'HIGH',
        bookingRequired: true,
        description: '中国大陆首座迪士尼主题乐园',
      },
      {
        name: '豫园',
        costCNY: 40,
        durationMin: 120,
        energy: 'LOW',
        bookingRequired: false,
        description: '明代江南私家园林，九曲桥与湖心亭',
      },
      {
        name: '上海博物馆',
        costCNY: 0,
        durationMin: 150,
        energy: 'LOW',
        bookingRequired: true,
        description: '中国古代艺术精品馆藏，青铜器与陶瓷为镇馆之宝',
      },
      {
        name: '田子坊',
        costCNY: 0,
        durationMin: 90,
        energy: 'LOW',
        bookingRequired: false,
        description: '石库门里弄改造的创意艺术街区',
      },
    ],
    dining: [
      { name: '绿波廊', costCNY: 150, description: '豫园内老字号，国宴级本帮菜，桂花拉糕一绝' },
      { name: '南翔馒头店', costCNY: 60, description: '始于1900年，招牌小笼包皮薄馅多汤鲜' },
      {
        name: '光明邨大酒家',
        costCNY: 50,
        description: '淮海路排队王，鲜肉月饼和酱鸭是上海人的心头好',
      },
    ],
    hotels: [
      {
        name: '上海外滩华尔道夫酒店',
        address: '黄浦区中山东一路2号',
        pricePerNight: 2200,
        reason: '坐拥外滩一线江景，老楼为新古典主义百年建筑',
        amenities: ['含早餐', '游泳池', 'SPA', '管家服务'],
      },
      {
        name: '全季酒店（南京东路步行街店）',
        address: '黄浦区南京东路680号',
        pricePerNight: 480,
        reason: '步行至外滩仅8分钟，地铁南京东路站上盖',
        amenities: ['含早餐', '免费WiFi', '洗衣服务'],
      },
    ],
    tips: [
      '迪士尼需下载官方App抢FP快速通行证',
      '外滩夜景比白天更美，建议傍晚抵达',
      '上海地铁用Metro大都会App扫码进站',
    ],
  },
  成都: {
    attractions: [
      {
        name: '大熊猫繁育研究基地',
        costCNY: 55,
        durationMin: 180,
        energy: 'MEDIUM',
        bookingRequired: false,
        description: '近距离观看国宝大熊猫，建议上午去熊猫更活跃',
      },
      {
        name: '宽窄巷子',
        costCNY: 0,
        durationMin: 120,
        energy: 'LOW',
        bookingRequired: false,
        description: '清代古街巷，宽巷子品茶、窄巷子购物、井巷子美食',
      },
      {
        name: '锦里古街',
        costCNY: 0,
        durationMin: 90,
        energy: 'LOW',
        bookingRequired: false,
        description: '紧邻武侯祠的三国风情街，灯笼夜景极美',
      },
      {
        name: '武侯祠',
        costCNY: 60,
        durationMin: 120,
        energy: 'LOW',
        bookingRequired: false,
        description: '纪念诸葛亮与刘备的祠庙，三国文化圣地',
      },
      {
        name: '青城山',
        costCNY: 80,
        durationMin: 240,
        energy: 'HIGH',
        bookingRequired: false,
        description: '道教发源地，前山问道后山观景',
      },
    ],
    dining: [
      {
        name: '小龙坎老火锅（春熙路店）',
        costCNY: 100,
        description: '成都火锅代表，牛油红锅麻辣鲜香，毛肚必点',
      },
      {
        name: '陈麻婆豆腐',
        costCNY: 50,
        description: '始创于1862年，麻婆豆腐发源地，麻辣烫嘴也不忍停筷',
      },
      { name: '钟水饺', costCNY: 25, description: '成都名小吃，红油水饺甜辣口，皮薄馅大' },
    ],
    hotels: [
      {
        name: '成都博舍（太古里）',
        address: '锦江区笔帖式街81号',
        pricePerNight: 1600,
        reason: '太古里内的设计酒店，闹中取静，融合川西院落风格',
        amenities: ['含早餐', '游泳池', 'SPA', '免费WiFi'],
      },
      {
        name: '成都宽窄巷子亚朵酒店',
        address: '青羊区长顺中街88号',
        pricePerNight: 420,
        reason: '步行3分钟到宽窄巷子，竹文化主题设计',
        amenities: ['含早餐', '免费WiFi', '自助洗衣'],
      },
    ],
    tips: [
      '熊猫基地建议8点开门就入园，9点后游客暴增',
      '成都美食多为麻辣，肠胃不适可备蒙脱石散',
      '成都地铁已覆盖主要景区，下载天府通App扫码乘车',
    ],
  },
  杭州: {
    attractions: [
      {
        name: '西湖风景区',
        costCNY: 0,
        durationMin: 180,
        energy: 'MEDIUM',
        bookingRequired: false,
        description: '世界文化遗产，苏堤春晓、断桥残雪、雷峰夕照',
      },
      {
        name: '灵隐寺',
        costCNY: 75,
        durationMin: 120,
        energy: 'LOW',
        bookingRequired: false,
        description: '千年古刹，济公活佛道场，飞来峰石刻艺术',
      },
      {
        name: '西溪国家湿地公园',
        costCNY: 80,
        durationMin: 180,
        energy: 'MEDIUM',
        bookingRequired: false,
        description: '城市湿地公园，乘摇橹船穿行芦苇荡',
      },
      {
        name: '龙井村',
        costCNY: 0,
        durationMin: 120,
        energy: 'LOW',
        bookingRequired: false,
        description: '西湖龙井茶核心产区，茶山漫步品明前茶',
      },
      {
        name: '宋城',
        costCNY: 300,
        durationMin: 240,
        energy: 'MEDIUM',
        bookingRequired: true,
        description: '大型宋文化主题公园，《宋城千古情》演出震撼',
      },
    ],
    dining: [
      {
        name: '楼外楼（孤山路店）',
        costCNY: 130,
        description: '西湖边的百年老店，东坡肉和西湖醋鱼是杭帮菜经典',
      },
      {
        name: '知味观（湖滨总店）',
        costCNY: 60,
        description: '杭州小吃集合店，猫耳朵、小笼包、片儿川面',
      },
      {
        name: '绿茶餐厅（龙井路店）',
        costCNY: 70,
        description: '开在茶园里的餐厅，环境绝美，面包诱惑和绿茶烤肉是招牌',
      },
    ],
    hotels: [
      {
        name: '杭州西子湖四季酒店',
        address: '西湖区灵隐路5号',
        pricePerNight: 2800,
        reason: '隐匿于西湖畔的园林式奢华酒店，江南庭院一步一景',
        amenities: ['含早餐', '游泳池', 'SPA', '管家服务', '免费WiFi'],
      },
      {
        name: '全季酒店（西湖湖滨店）',
        address: '上城区延安路228号',
        pricePerNight: 420,
        reason: '步行至西湖仅5分钟，地铁龙翔桥站旁',
        amenities: ['含早餐', '免费WiFi', '行李寄存'],
      },
    ],
    tips: [
      '西湖建议租共享单车环湖，步行太累',
      '灵隐寺早8点前人少，可避开旅游团',
      '杭州东站到西湖景区地铁约20分钟',
    ],
  },
  厦门: {
    attractions: [
      {
        name: '鼓浪屿',
        costCNY: 35,
        durationMin: 360,
        energy: 'MEDIUM',
        bookingRequired: true,
        description: '世界文化遗产，钢琴之岛，万国建筑博览',
      },
      {
        name: '厦门大学',
        costCNY: 0,
        durationMin: 90,
        energy: 'LOW',
        bookingRequired: true,
        description: '中国最美大学之一，芙蓉隧道涂鸦墙必打卡',
      },
      {
        name: '南普陀寺',
        costCNY: 0,
        durationMin: 60,
        energy: 'LOW',
        bookingRequired: false,
        description: '闽南佛教圣地，紧邻厦大，素斋出名',
      },
      {
        name: '曾厝垵',
        costCNY: 0,
        durationMin: 120,
        energy: 'LOW',
        bookingRequired: false,
        description: '文艺渔村改造，小吃和文创小店聚集',
      },
      {
        name: '环岛路',
        costCNY: 0,
        durationMin: 90,
        energy: 'MEDIUM',
        bookingRequired: false,
        description: '沿海骑行道，椰风海韵，途径胡里山炮台',
      },
    ],
    dining: [
      {
        name: '堂宴·老厦门私房菜',
        costCNY: 80,
        description: '谢霆锋光顾过的闽南私房菜，沙茶面一绝',
      },
      { name: '乌堂沙茶面', costCNY: 25, description: '厦门沙茶面代表，汤底浓郁，配料自选' },
      {
        name: '黄则和花生汤',
        costCNY: 15,
        description: '百年老字号，花生汤配韭菜盒是厦门人的下午茶',
      },
    ],
    hotels: [
      {
        name: '厦门康莱德酒店',
        address: '思明区演武西路186号',
        pricePerNight: 1500,
        reason: '世茂海峡大厦双子塔内，海景房直面鼓浪屿',
        amenities: ['含早餐', '游泳池', '海景健身房', '免费WiFi'],
      },
      {
        name: '全季酒店（中山路步行街店）',
        address: '思明区中山路228号',
        pricePerNight: 380,
        reason: '中山路核心位置，步行可达轮渡码头去鼓浪屿',
        amenities: ['含早餐', '免费WiFi', '行李寄存'],
      },
    ],
    tips: [
      '鼓浪屿船票需提前在「厦门轮渡」公众号预约',
      '厦大需预约入校，每天限流',
      '曾厝垵建议傍晚去，白天较晒，夜景更有氛围',
    ],
  },
  长沙: {
    attractions: [
      {
        name: '岳麓山风景名胜区',
        costCNY: 0,
        durationMin: 180,
        energy: 'MEDIUM',
        bookingRequired: false,
        description: '南岳衡山余脉，爱晚亭秋色、岳麓书院千年学府',
      },
      {
        name: '橘子洲头',
        costCNY: 0,
        durationMin: 120,
        energy: 'LOW',
        bookingRequired: false,
        description: '湘江中心长岛，毛泽东青年雕像雄伟壮观',
      },
      {
        name: '湖南省博物馆',
        costCNY: 0,
        durationMin: 150,
        energy: 'LOW',
        bookingRequired: true,
        description: '马王堆汉墓出土文物，辛追夫人千年不腐遗体',
      },
      {
        name: '太平街',
        costCNY: 0,
        durationMin: 90,
        energy: 'LOW',
        bookingRequired: false,
        description: '长沙千年古街，青石板路两旁小吃和文创店林立',
      },
      {
        name: 'IFS国金中心',
        costCNY: 0,
        durationMin: 60,
        energy: 'LOW',
        bookingRequired: false,
        description: '长沙最高楼，KAWS雕塑屋顶打卡地标',
      },
    ],
    dining: [
      {
        name: '文和友（海信广场店）',
        costCNY: 100,
        description: '还原80年代老长沙场景的超级餐厅，口味虾和臭豆腐必点',
      },
      {
        name: '炊烟时代小炒黄牛肉',
        costCNY: 70,
        description: '走进联合国的湘菜代表，小炒黄牛肉嫩滑下饭',
      },
      { name: '茶颜悦色', costCNY: 18, description: '长沙城市名片，幽兰拿铁和声声乌龙是招牌奶茶' },
      { name: '黑色经典臭豆腐', costCNY: 15, description: '长沙臭豆腐第一品牌，外焦里嫩灌汤吃' },
    ],
    hotels: [
      {
        name: '长沙尼依格罗酒店',
        address: '芙蓉区解放西路188号IFS 93层',
        pricePerNight: 1380,
        reason: '湖南最高酒店，云端大堂俯瞰湘江与岳麓山',
        amenities: ['含早餐', '游泳池', '天际酒吧', '管家服务'],
      },
      {
        name: '全季酒店（五一广场店）',
        address: '天心区五一大道717号',
        pricePerNight: 380,
        reason: '五一广场商圈核心，地铁站出来就是太平街',
        amenities: ['含早餐', '免费WiFi', '行李寄存'],
      },
      {
        name: '长沙IFS亚朵酒店',
        address: '芙蓉区解放西路168号',
        pricePerNight: 520,
        reason: '紧邻IFS国金中心，步行5分钟到黄兴路步行街',
        amenities: ['含早餐', '免费WiFi', '自助洗衣', '竹居书吧'],
      },
    ],
    tips: [
      '湖南省博物馆需提前3天在公众号预约，周一闭馆',
      '岳麓山索道和滑道超好玩，建议索道上滑道下',
      '长沙小吃偏辣，茶颜悦色几乎每50米一家不用排队太久',
    ],
  },
  广州: {
    attractions: [
      {
        name: '广州塔（小蛮腰）',
        costCNY: 150,
        durationMin: 120,
        energy: 'LOW',
        bookingRequired: false,
        description: '600米高电视塔，摩天轮和极速云霄位于塔顶',
      },
      {
        name: '沙面岛',
        costCNY: 0,
        durationMin: 90,
        energy: 'LOW',
        bookingRequired: false,
        description: '珠江畔欧陆风情小岛，19世纪领事馆建筑群',
      },
      {
        name: '长隆欢乐世界',
        costCNY: 250,
        durationMin: 360,
        energy: 'HIGH',
        bookingRequired: true,
        description: '亚洲顶级主题乐园，垂直过山车和U型滑板刺激',
      },
      {
        name: '白云山',
        costCNY: 5,
        durationMin: 180,
        energy: 'MEDIUM',
        bookingRequired: false,
        description: '羊城第一秀，摩星岭观日出、云台花园赏花',
      },
      {
        name: '陈家祠',
        costCNY: 10,
        durationMin: 90,
        energy: 'LOW',
        bookingRequired: false,
        description: '岭南建筑艺术明珠，石雕木雕砖雕三绝',
      },
    ],
    dining: [
      { name: '点都德', costCNY: 70, description: '广州早茶标杆，金莎红米肠和非遗叉烧包是招牌' },
      {
        name: '广州酒家（文昌总店）',
        costCNY: 100,
        description: '始于1935年，文昌鸡和金牌乳猪是广府菜代表',
      },
      { name: '银记肠粉', costCNY: 20, description: '广州肠粉第一品牌，鲜虾肠粉皮薄透亮爽滑' },
    ],
    hotels: [
      {
        name: '广州四季酒店',
        address: '天河区珠江新城珠江西路5号IFC 70-100层',
        pricePerNight: 1800,
        reason: '云端酒店，房间俯瞰珠江新城中轴线全景',
        amenities: ['含早餐', '游泳池', 'SPA', '管家服务'],
      },
      {
        name: '全季酒店（天河城店）',
        address: '天河区天河路208号',
        pricePerNight: 400,
        reason: '地铁体育西路站上盖，天河城、正佳广场步行可达',
        amenities: ['含早餐', '免费WiFi', '行李寄存'],
      },
    ],
    tips: [
      '广州地铁三日通票¥50，市内景点全覆盖',
      '早茶建议9点前到，热门店10点后需排长队',
      '广州夏季多雨，随身带伞',
    ],
  },
  深圳: {
    attractions: [
      {
        name: '深圳湾公园',
        costCNY: 0,
        durationMin: 120,
        energy: 'LOW',
        bookingRequired: false,
        description: '15公里滨海长廊，红树林湿地与香港隔海相望',
      },
      {
        name: '世界之窗',
        costCNY: 220,
        durationMin: 300,
        energy: 'MEDIUM',
        bookingRequired: false,
        description: '世界名胜微缩主题公园，埃菲尔铁塔烟花秀',
      },
      {
        name: '欢乐谷',
        costCNY: 230,
        durationMin: 360,
        energy: 'HIGH',
        bookingRequired: false,
        description: '大型主题乐园，雪山飞龙悬挂过山车必玩',
      },
      {
        name: '华侨城创意文化园',
        costCNY: 0,
        durationMin: 90,
        energy: 'LOW',
        bookingRequired: false,
        description: '旧厂房改造的艺术区，周末创意市集人气爆棚',
      },
    ],
    dining: [
      { name: '蘩楼', costCNY: 80, description: '深圳早茶人气王，虾饺皇皮薄馅大，金钱肚软糯入味' },
      {
        name: '八合里牛肉火锅',
        costCNY: 90,
        description: '潮汕牛肉火锅代表，三花趾五花趾现切现涮',
      },
      {
        name: '润园四季椰子鸡',
        costCNY: 70,
        description: '深圳特色椰子鸡火锅，竹笙椰子鸡汤清甜鲜美',
      },
    ],
    hotels: [
      {
        name: '深圳瑞吉酒店',
        address: '罗湖区深南东路5016号京基100大厦96层',
        pricePerNight: 1600,
        reason: '深圳最高酒店，俯瞰深圳河与香港新界',
        amenities: ['含早餐', '游泳池', '天际酒吧', '管家服务'],
      },
      {
        name: '全季酒店（福田会展中心店）',
        address: '福田区福华三路88号',
        pricePerNight: 420,
        reason: '步行至深圳湾公园15分钟，地铁会展中心站旁',
        amenities: ['含早餐', '免费WiFi', '行李寄存'],
      },
    ],
    tips: [
      '深圳地铁用「深圳通」小程序扫码乘车',
      '世界之窗夜场票¥100更划算，19:30有烟花秀',
      '深圳湾公园日出剧场适合清晨跑步看日出',
    ],
  },
  重庆: {
    attractions: [
      {
        name: '洪崖洞',
        costCNY: 0,
        durationMin: 90,
        energy: 'LOW',
        bookingRequired: false,
        description: '依山而建的吊脚楼群，夜景如千与千寻童话世界',
      },
      {
        name: '磁器口古镇',
        costCNY: 0,
        durationMin: 120,
        energy: 'LOW',
        bookingRequired: false,
        description: '千年古镇，陈麻花总店和手工酸辣粉必尝',
      },
      {
        name: '解放碑步行街',
        costCNY: 0,
        durationMin: 90,
        energy: 'LOW',
        bookingRequired: false,
        description: '重庆最繁华商圈，抗战胜利纪功碑地标',
      },
      {
        name: '长江索道',
        costCNY: 20,
        durationMin: 30,
        energy: 'LOW',
        bookingRequired: false,
        description: '万里长江第一条空中走廊，空中俯瞰两江交汇',
      },
      {
        name: '武隆天生三桥',
        costCNY: 135,
        durationMin: 300,
        energy: 'HIGH',
        bookingRequired: false,
        description: '世界自然遗产，《变形金刚4》取景地，天坑地缝奇观',
      },
    ],
    dining: [
      {
        name: '佩姐老火锅（较场口店）',
        costCNY: 90,
        description: '重庆火锅排队王，九宫格牛油红汤，鸭血毛肚绝配',
      },
      {
        name: '花市豌杂面',
        costCNY: 15,
        description: '重庆小面代表，豌杂酱香浓面劲道，入选米其林必比登',
      },
      { name: '山城小汤圆', costCNY: 10, description: '磁器口百年甜品，醪糟小汤圆软糯香甜' },
    ],
    hotels: [
      {
        name: '重庆来福士洲际酒店',
        address: '渝中区长江滨江路2号来福士广场',
        pricePerNight: 1400,
        reason: '朝天门地标建筑，270°环幕江景俯瞰两江交汇',
        amenities: ['含早餐', '游泳池', '行政酒廊', '管家服务'],
      },
      {
        name: '全季酒店（解放碑洪崖洞店）',
        address: '渝中区沧白路46号',
        pricePerNight: 380,
        reason: '步行至洪崖洞5分钟，解放碑10分钟',
        amenities: ['含早餐', '免费WiFi', '行李寄存'],
      },
    ],
    tips: [
      '重庆是山城，穿平底鞋！导航距离不可信，多看路牌',
      '洪崖洞夜景最佳观赏点在千厮门大桥上',
      '长江索道建议早8点或晚9点后乘坐避开排队高峰',
    ],
  },
  西安: {
    attractions: [
      {
        name: '秦始皇兵马俑博物馆',
        costCNY: 120,
        durationMin: 240,
        energy: 'HIGH',
        bookingRequired: false,
        description: '世界第八大奇迹，八千陶俑军阵震撼人心',
      },
      {
        name: '西安城墙',
        costCNY: 54,
        durationMin: 120,
        energy: 'MEDIUM',
        bookingRequired: false,
        description: '中国现存最完整的古代城垣，租自行车环城墙超赞',
      },
      {
        name: '大雁塔·大唐不夜城',
        costCNY: 60,
        durationMin: 120,
        energy: 'LOW',
        bookingRequired: false,
        description: '玄奘译经之地，晚上大唐不夜城灯火辉煌如穿越盛唐',
      },
      {
        name: '回民街',
        costCNY: 0,
        durationMin: 120,
        energy: 'LOW',
        bookingRequired: false,
        description: '西安小吃天堂，肉夹馍羊肉泡馍biangbiang面一条街',
      },
      {
        name: '华清宫',
        costCNY: 120,
        durationMin: 150,
        energy: 'MEDIUM',
        bookingRequired: false,
        description: '唐玄宗与杨贵妃的爱情故事发生地，骊山温泉',
      },
    ],
    dining: [
      {
        name: '回民街贾三灌汤包子',
        costCNY: 40,
        description: '西安灌汤包代表，皮薄汤鲜肉嫩，一提一吸间满口香',
      },
      {
        name: '同盛祥泡馍馆',
        costCNY: 50,
        description: '百年老字号，亲手掰馍体验，羊肉泡馍汤浓馍香',
      },
      {
        name: '长安大排档',
        costCNY: 70,
        description: '还原唐代市井场景，毛笔酥和葫芦鸡是颜值担当',
      },
    ],
    hotels: [
      {
        name: '西安君悦酒店',
        address: '未央区凤城八路168号',
        pricePerNight: 1100,
        reason: '高新区核心，高空大堂可观终南山',
        amenities: ['含早餐', '游泳池', '行政酒廊', '免费WiFi'],
      },
      {
        name: '全季酒店（钟楼回民街店）',
        address: '碑林区西大街88号',
        pricePerNight: 360,
        reason: '步行至钟楼3分钟、回民街5分钟，地铁钟楼站旁',
        amenities: ['含早餐', '免费WiFi', '行李寄存'],
      },
    ],
    tips: [
      '兵马俑距市区约1小时车程，建议报一日游或乘游5路公交',
      '回民街主街偏游客，往里走小巷子更地道便宜',
      '城墙骑行全程约14公里，1.5~2小时',
    ],
  },
};

// ─────────────────────────────────────────────
// 城际交通 mock 数据
// ─────────────────────────────────────────────

/** 获取两个城市之间的 mock 交通方案 */
function getMockTransport(from: string, to: string): Record<string, unknown> {
  const routes: Record<string, Record<string, unknown>> = {
    北京_上海: {
      type: 'high_speed_rail',
      trainNumber: 'G1',
      departTime: '09:00',
      arriveTime: '13:28',
      durationMinutes: 268,
      pricePerPerson: { secondClass: 553, firstClass: 933 },
      departureStation: '北京南站',
      arrivalStation: '上海虹桥站',
      bookingUrl: 'https://www.12306.cn',
      note: '⚠️ 车次信息仅供参考，请尽快到 12306 / 携程 / 飞猪 订票',
    },
    北京_成都: {
      type: 'high_speed_rail',
      trainNumber: 'G307',
      departTime: '09:38',
      arriveTime: '20:55',
      durationMinutes: 677,
      pricePerPerson: { secondClass: 790, firstClass: 1250 },
      departureStation: '北京西站',
      arrivalStation: '成都东站',
      bookingUrl: 'https://www.12306.cn',
      note: '⚠️ 车次信息仅供参考，请尽快到 12306 / 携程 / 飞猪 订票',
    },
    北京_杭州: {
      type: 'high_speed_rail',
      trainNumber: 'G31',
      departTime: '07:56',
      arriveTime: '12:33',
      durationMinutes: 277,
      pricePerPerson: { secondClass: 538, firstClass: 907 },
      departureStation: '北京南站',
      arrivalStation: '杭州东站',
      bookingUrl: 'https://www.12306.cn',
      note: '⚠️ 车次信息仅供参考，请尽快到 12306 / 携程 / 飞猪 订票',
    },
    北京_厦门: {
      type: 'high_speed_rail',
      trainNumber: 'G321',
      departTime: '08:47',
      arriveTime: '19:30',
      durationMinutes: 643,
      pricePerPerson: { secondClass: 830, firstClass: 1350 },
      departureStation: '北京南站',
      arrivalStation: '厦门北站',
      bookingUrl: 'https://www.12306.cn',
      note: '⚠️ 车次信息仅供参考，请尽快到 12306 / 携程 / 飞猪 订票',
    },
    北京_长沙: {
      type: 'high_speed_rail',
      trainNumber: 'G79',
      departTime: '08:00',
      arriveTime: '13:36',
      durationMinutes: 336,
      pricePerPerson: { secondClass: 649, firstClass: 1038 },
      departureStation: '北京西站',
      arrivalStation: '长沙南站',
      bookingUrl: 'https://www.12306.cn',
      note: '⚠️ 车次信息仅供参考，请尽快到 12306 / 携程 / 飞猪 订票',
    },
    北京_广州: {
      type: 'high_speed_rail',
      trainNumber: 'G79',
      departTime: '08:00',
      arriveTime: '16:38',
      durationMinutes: 518,
      pricePerPerson: { secondClass: 862, firstClass: 1380 },
      departureStation: '北京西站',
      arrivalStation: '广州南站',
      bookingUrl: 'https://www.12306.cn',
      note: '⚠️ 车次信息仅供参考，请尽快到 12306 / 携程 / 飞猪 订票',
    },
    北京_深圳: {
      type: 'high_speed_rail',
      trainNumber: 'G79',
      departTime: '08:00',
      arriveTime: '17:13',
      durationMinutes: 553,
      pricePerPerson: { secondClass: 890, firstClass: 1400 },
      departureStation: '北京西站',
      arrivalStation: '深圳北站',
      bookingUrl: 'https://www.12306.cn',
      note: '⚠️ 车次信息仅供参考，请尽快到 12306 / 携程 / 飞猪 订票',
    },
    北京_重庆: {
      type: 'high_speed_rail',
      trainNumber: 'G309',
      departTime: '08:23',
      arriveTime: '19:33',
      durationMinutes: 670,
      pricePerPerson: { secondClass: 795, firstClass: 1255 },
      departureStation: '北京西站',
      arrivalStation: '重庆西站',
      bookingUrl: 'https://www.12306.cn',
      note: '⚠️ 车次信息仅供参考，请尽快到 12306 / 携程 / 飞猪 订票',
    },
    北京_西安: {
      type: 'high_speed_rail',
      trainNumber: 'G651',
      departTime: '07:50',
      arriveTime: '13:00',
      durationMinutes: 310,
      pricePerPerson: { secondClass: 515, firstClass: 824 },
      departureStation: '北京西站',
      arrivalStation: '西安北站',
      bookingUrl: 'https://www.12306.cn',
      note: '⚠️ 车次信息仅供参考，请尽快到 12306 / 携程 / 飞猪 订票',
    },
    成都_重庆: {
      type: 'high_speed_rail',
      trainNumber: 'G8681',
      departTime: '10:00',
      arriveTime: '11:37',
      durationMinutes: 97,
      pricePerPerson: { secondClass: 154, firstClass: 246 },
      departureStation: '成都东站',
      arrivalStation: '重庆西站',
      bookingUrl: 'https://www.12306.cn',
      note: '⚠️ 车次信息仅供参考，请尽快到 12306 / 携程 / 飞猪 订票',
    },
    成都_西安: {
      type: 'high_speed_rail',
      trainNumber: 'D1912',
      departTime: '07:05',
      arriveTime: '10:56',
      durationMinutes: 231,
      pricePerPerson: { secondClass: 263, firstClass: 421 },
      departureStation: '成都东站',
      arrivalStation: '西安北站',
      bookingUrl: 'https://www.12306.cn',
      note: '⚠️ 车次信息仅供参考，请尽快到 12306 / 携程 / 飞猪 订票',
    },
    杭州_上海: {
      type: 'high_speed_rail',
      trainNumber: 'G7536',
      departTime: '09:23',
      arriveTime: '10:17',
      durationMinutes: 54,
      pricePerPerson: { secondClass: 73, firstClass: 117 },
      departureStation: '杭州东站',
      arrivalStation: '上海虹桥站',
      bookingUrl: 'https://www.12306.cn',
      note: '⚠️ 车次信息仅供参考，请尽快到 12306 / 携程 / 飞猪 订票',
    },
    长沙_广州: {
      type: 'high_speed_rail',
      trainNumber: 'G6151',
      departTime: '08:22',
      arriveTime: '10:50',
      durationMinutes: 148,
      pricePerPerson: { secondClass: 314, firstClass: 504 },
      departureStation: '长沙南站',
      arrivalStation: '广州南站',
      bookingUrl: 'https://www.12306.cn',
      note: '⚠️ 车次信息仅供参考，请尽快到 12306 / 携程 / 飞猪 订票',
    },
    广州_深圳: {
      type: 'high_speed_rail',
      trainNumber: 'G6201',
      departTime: '08:34',
      arriveTime: '09:05',
      durationMinutes: 31,
      pricePerPerson: { secondClass: 74, firstClass: 99 },
      departureStation: '广州南站',
      arrivalStation: '深圳北站',
      bookingUrl: 'https://www.12306.cn',
      note: '⚠️ 车次信息仅供参考，请尽快到 12306 / 携程 / 飞猪 订票',
    },
    深圳_厦门: {
      type: 'high_speed_rail',
      trainNumber: 'D2342',
      departTime: '08:15',
      arriveTime: '11:20',
      durationMinutes: 185,
      pricePerPerson: { secondClass: 180, firstClass: 259 },
      departureStation: '深圳北站',
      arrivalStation: '厦门北站',
      bookingUrl: 'https://www.12306.cn',
      note: '⚠️ 车次信息仅供参考，请尽快到 12306 / 携程 / 飞猪 订票',
    },
    重庆_成都: {
      type: 'high_speed_rail',
      trainNumber: 'G8684',
      departTime: '10:30',
      arriveTime: '12:14',
      durationMinutes: 104,
      pricePerPerson: { secondClass: 154, firstClass: 246 },
      departureStation: '重庆西站',
      arrivalStation: '成都东站',
      bookingUrl: 'https://www.12306.cn',
      note: '⚠️ 车次信息仅供参考，请尽快到 12306 / 携程 / 飞猪 订票',
    },
  };

  const key = `${from}_${to}`;
  return (
    routes[key] ?? {
      type: 'high_speed_rail',
      trainNumber: `G${1000 + Math.floor(Math.random() * 9000)}`,
      departTime: '08:00',
      arriveTime: `12:00`,
      durationMinutes: 240,
      pricePerPerson: { secondClass: 400, firstClass: 640 },
      departureStation: `${from}站`,
      arrivalStation: `${to}站`,
      bookingUrl: 'https://www.12306.cn',
      note: '⚠️ 车次信息仅供参考，请尽快到 12306 / 携程 / 飞猪 订票',
    }
  );
}

// ─────────────────────────────────────────────

/** Mock 天计划生成参数 */
export interface MockDayParams {
  dayIndex: number;
  cityName: string;
  isFirstDayOfCity: boolean;
  daysInCity: number;
}

/**
 * 攻略请求校验 + 冲突检测
 */
export function validateTripRequest(req: TripGenerateRequest): TripValidationResponse {
  const conflicts: TripValidationResponse['conflicts'] = [];

  // budget + accommodation 冲突
  if (
    req.preferences.budget === 'economy' &&
    (req.preferences.accommodation === 'boutique' || req.preferences.accommodation === 'luxury')
  ) {
    conflicts.push({
      type: 'budget_accommodation',
      severity: 'warning',
      message: '穷游预算下选择精品酒店可能超预算，建议调整为经济型或连锁酒店',
      suggestion: { action: 'set_accommodation', value: 'chain_hotel' },
    });
  }

  // pace + elders 冲突
  if (req.travelers.elders > 0 && req.preferences.pace === 'intensive') {
    conflicts.push({
      type: 'pace_elders',
      severity: 'warning',
      message: '同行有老人，高强度节奏可能较辛苦，建议调整为适中节奏',
      suggestion: { action: 'set_pace', value: 'moderate' },
    });
  }

  return { valid: true, conflicts };
}

/**
 * 查询攻略列表
 */
export async function listTrips(_userId: string): Promise<TripSummary[]> {
  // MVP stub
  return [];
}

/**
 * 查询完整攻略
 */
export async function getTrip(tripId: string): Promise<TripResponse | null> {
  return tripStore.get(tripId) ?? null;
}

/**
 * 查询单天行程
 */
export async function getDayPlan(_tripId: string, _dayIndex: number): Promise<unknown | null> {
  // MVP stub
  return null;
}

/**
 * 修改单天行程
 */
export async function updateDayPlan(
  _tripId: string,
  _dayIndex: number,
  _req: DayUpdateRequest,
): Promise<unknown> {
  return {
    dayIndex: _dayIndex,
    validation: { valid: true, warnings: [] },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 删除攻略
 */
export async function deleteTrip(_tripId: string): Promise<{ deletedAt: string }> {
  return { deletedAt: new Date().toISOString() };
}

/**
 * 导出攻略
 */
export async function exportTrip(
  _tripId: string,
  _options: ExportOptions,
): Promise<ExportResponse> {
  return {
    exportId: 'export_mock',
    status: 'ready',
    downloadUrl: 'https://cdn.example.com/exports/trip_mock.pdf',
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    format: _options.format,
    sizeBytes: 2048000,
  };
}

/**
 * 重新生成某天（SSE）
 */
export async function regenerateDay(
  _tripId: string,
  _req: TripRegenerateRequest,
): Promise<{ taskId: string }> {
  return { taskId: `regenerate_${Date.now()}` };
}

/**
 * 为目的地生成 mock 天计划，使用城市真实数据
 * @param dayIndex - 全局天的索引（1-based）
 * @param cityName - 城市名
 * @param isFirstDayOfCity - 是否为该城市的第 0 天（抵达日）
 * @param daysInCity - 该城市总天数
 * @param prefs - 偏好设置
 * @param transport - 前往该城市的交通信息（第一个城市和后续城市不同）
 */
export function generateMockDay(
  dayIndex: number,
  cityName: string,
  isFirstDayOfCity: boolean,
  daysInCity: number,
  prefs?: TripGenerateRequest['preferences'],
  transport?: Record<string, unknown> | null,
): DayPlan {
  const dayType = isFirstDayOfCity ? 'transit_departure' : 'city_exploration';
  const date = new Date(2026, 6, dayIndex);
  const dateStr = date.toISOString().slice(0, 10);
  const data = CITY_DATA[cityName] ?? CITY_DATA.长沙;

  // 每天选不同的景点（根据 dayIndex 轮转）
  const attrIndex = (dayIndex - 1) % data.attractions.length;
  const dineIndex = (dayIndex - 1) % data.dining.length;

  const morningAttr = data.attractions[attrIndex];
  const afternoonAttr = data.attractions[(attrIndex + 1) % data.attractions.length];

  const budgetMultiplier = prefs?.budget === 'economy' ? 0.5 : prefs?.budget === 'luxury' ? 2.5 : 1;

  const timeline: TimelineItem[] = isFirstDayOfCity
    ? [
        {
          id: `item_${dayIndex}_001`,
          type: 'dining',
          title: `午餐：${data.dining[dineIndex].name}`,
          description: data.dining[dineIndex].description,
          startTime: '12:00',
          endTime: '13:30',
          estimatedDuration: 90,
          estimatedCostCNY: Math.round(data.dining[dineIndex].costCNY * budgetMultiplier),
          energyLevel: 'LOW',
          bookingRequired: false,
        },
        {
          id: `item_${dayIndex}_002`,
          type: 'attraction',
          title: morningAttr.name,
          description: morningAttr.description,
          startTime: '14:00',
          endTime: `${String(14 + Math.floor(morningAttr.durationMin / 60)).padStart(2, '0')}:${String(morningAttr.durationMin % 60).padStart(2, '0')}`,
          estimatedDuration: morningAttr.durationMin,
          estimatedCostCNY: Math.round(morningAttr.costCNY * budgetMultiplier),
          energyLevel: morningAttr.energy,
          bookingRequired: morningAttr.bookingRequired,
        },
        {
          id: `item_${dayIndex}_003`,
          type: 'dining',
          title: `晚餐：${data.dining[(dineIndex + 1) % data.dining.length].name}`,
          description: data.dining[(dineIndex + 1) % data.dining.length].description,
          startTime: '18:00',
          endTime: '19:30',
          estimatedDuration: 90,
          estimatedCostCNY: Math.round(
            data.dining[(dineIndex + 1) % data.dining.length].costCNY * budgetMultiplier,
          ),
          energyLevel: 'LOW',
          bookingRequired: false,
        },
      ]
    : [
        {
          id: `item_${dayIndex}_001`,
          type: 'attraction',
          title: morningAttr.name,
          description: morningAttr.description,
          startTime: '09:00',
          endTime: `${String(9 + Math.floor(morningAttr.durationMin / 60)).padStart(2, '0')}:${String(morningAttr.durationMin % 60).padStart(2, '0')}`,
          estimatedDuration: morningAttr.durationMin,
          estimatedCostCNY: Math.round(morningAttr.costCNY * budgetMultiplier),
          energyLevel: morningAttr.energy,
          bookingRequired: morningAttr.bookingRequired,
        },
        {
          id: `item_${dayIndex}_002`,
          type: 'dining',
          title: `午餐：${data.dining[dineIndex].name}`,
          description: data.dining[dineIndex].description,
          startTime: '12:30',
          endTime: '14:00',
          estimatedDuration: 90,
          estimatedCostCNY: Math.round(data.dining[dineIndex].costCNY * budgetMultiplier),
          energyLevel: 'LOW',
          bookingRequired: false,
        },
        {
          id: `item_${dayIndex}_003`,
          type: 'attraction',
          title: afternoonAttr.name,
          description: afternoonAttr.description,
          startTime: '14:30',
          endTime: `${String(14 + Math.floor(afternoonAttr.durationMin / 60) + 1).padStart(2, '0')}:${String(afternoonAttr.durationMin % 60).padStart(2, '0')}`,
          estimatedDuration: afternoonAttr.durationMin,
          estimatedCostCNY: Math.round(afternoonAttr.costCNY * budgetMultiplier),
          energyLevel: afternoonAttr.energy,
          bookingRequired: afternoonAttr.bookingRequired,
        },
      ];

  // 住宿（只在该城市第一天提供）
  const hotelBudget = prefs?.budget ?? 'comfort';
  const hotelIndices =
    hotelBudget === 'economy'
      ? [1, 1]
      : hotelBudget === 'luxury'
        ? [0, 1]
        : [data.hotels.length > 1 ? 1 : 0, data.hotels.length > 2 ? 2 : 0];
  const primaryHotel = data.hotels[Math.min(hotelIndices[0], data.hotels.length - 1)];
  const backupHotel = data.hotels[Math.min(hotelIndices[1], data.hotels.length - 1)];

  const primary: HotelOption = {
    name: primaryHotel.name,
    address: primaryHotel.address,
    pricePerNight: Math.round(primaryHotel.pricePerNight * budgetMultiplier),
    totalPrice: Math.round(primaryHotel.pricePerNight * daysInCity * budgetMultiplier),
    reason: primaryHotel.reason,
    amenities: primaryHotel.amenities,
  };

  const backup: HotelOption = {
    name: backupHotel.name,
    address: backupHotel.address,
    pricePerNight: Math.round(backupHotel.pricePerNight * budgetMultiplier),
    totalPrice: Math.round(backupHotel.pricePerNight * daysInCity * budgetMultiplier),
    reason: backupHotel.reason,
    amenities: backupHotel.amenities,
  };

  const accommodation: AccommodationOption | null = isFirstDayOfCity
    ? {
        checkInDate: dateStr,
        checkOutDate: new Date(2026, 6, dayIndex + daysInCity).toISOString().slice(0, 10),
        nights: daysInCity,
        primary,
        backup,
      }
    : null;

  return {
    dayIndex,
    date: dateStr,
    dayType,
    cityName,
    isFirstDayOfCity,
    title: `Day ${dayIndex} · ${isFirstDayOfCity ? `抵达${cityName}` : `${cityName}深度游`}`,
    timeline,
    accommodation,
    transport: isFirstDayOfCity ? (transport ?? null) : null,
    tips: data.tips.slice(0, Math.min(2, data.tips.length)),
  };
}

/** 获取两个城市间的 mock 交通 */
export { getMockTransport };
