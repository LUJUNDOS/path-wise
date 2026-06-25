/**
 * PATH-WISE · 数据库种子脚本
 * 依据：docs/数据库设计规格书_v1.0.0.md §3.6 城市注册表 + §6 城市知识库
 *
 * 职责：
 *   - cities 表：写入首批 5 个城市（长沙、成都、杭州、西安、厦门）
 *   - 后续阶段二可扩展为从 JSON 知识库文件批量导入
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** 首批 seed 城市列表 */
const SEED_CITIES = [
  {
    nameZh: '长沙',
    nameEn: 'Changsha',
    province: '湖南省',
    amapCityCode: '0731',
    amapAdcode: '430100',
    kbStatus: 'available',
    kbVersion: 'v1.0',
    kbLastUpdated: new Date('2026-06-19'),
    isHubCity: true,
    typicalDays: 3,
    centerLat: 28.2282,
    centerLng: 112.9388,
  },
  {
    nameZh: '成都',
    nameEn: 'Chengdu',
    province: '四川省',
    amapCityCode: '028',
    amapAdcode: '510100',
    kbStatus: 'available',
    kbVersion: 'v1.0',
    kbLastUpdated: new Date('2026-06-19'),
    isHubCity: true,
    typicalDays: 3,
    centerLat: 30.5728,
    centerLng: 104.0668,
  },
  {
    nameZh: '杭州',
    nameEn: 'Hangzhou',
    province: '浙江省',
    amapCityCode: '0571',
    amapAdcode: '330100',
    kbStatus: 'available',
    kbVersion: 'v1.0',
    kbLastUpdated: new Date('2026-06-19'),
    isHubCity: false,
    typicalDays: 3,
    centerLat: 30.2741,
    centerLng: 120.1551,
  },
  {
    nameZh: '西安',
    nameEn: "Xi'an",
    province: '陕西省',
    amapCityCode: '029',
    amapAdcode: '610100',
    kbStatus: 'available',
    kbVersion: 'v1.0',
    kbLastUpdated: new Date('2026-06-19'),
    isHubCity: true,
    typicalDays: 3,
    centerLat: 34.3416,
    centerLng: 108.9398,
  },
  {
    nameZh: '厦门',
    nameEn: 'Xiamen',
    province: '福建省',
    amapCityCode: '0592',
    amapAdcode: '350200',
    kbStatus: 'partial',
    kbVersion: 'v1.0',
    kbLastUpdated: new Date('2026-06-19'),
    isHubCity: false,
    typicalDays: 2,
    centerLat: 24.4798,
    centerLng: 118.0894,
  },
];

async function seed() {
  console.log('🌱 开始导入城市数据到 cities 表...\n');

  let inserted = 0;

  for (const cityData of SEED_CITIES) {
    try {
      const city = await prisma.city.upsert({
        where: { nameZh: cityData.nameZh },
        update: {},
        create: cityData,
      });

      console.log(`  ✅ ${city.nameZh}（${city.nameEn}）`);
      console.log(`     ID: ${city.id}`);
      console.log(`     知识库状态: ${city.kbStatus}`);
      console.log(`     建议游玩天数: ${city.typicalDays} 天`);
      console.log(`     枢纽城市: ${city.isHubCity ? '是' : '否'}`);
      console.log();
      inserted++;
    } catch (error) {
      console.error(`  ❌ ${cityData.nameZh} 导入失败:`, error);
    }
  }

  console.log(`📊 成功导入 ${inserted}/${SEED_CITIES.length} 个城市`);
  console.log();

  // 输出城市概要
  const allCities = await prisma.city.findMany({
    orderBy: { nameZh: 'asc' },
  });

  console.log('📋 当前 cities 表记录：');
  console.log('─'.repeat(60));
  for (const c of allCities) {
    console.log(
      `  ${c.nameZh.padEnd(6)} | ${c.province.padEnd(6)} | ${c.kbStatus.padEnd(12)} | 枢纽:${c.isHubCity ? '✓' : '✗'} | ${c.typicalDays}天`,
    );
  }
  console.log();
  console.log('✅ 种子数据导入完成！');
}

seed()
  .catch((error) => {
    console.error('❌ 种子脚本执行失败:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
