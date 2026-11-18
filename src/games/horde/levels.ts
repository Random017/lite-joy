/* 无尽火线 · 关卡数据
 *
 * 手写、可改、类型护航：改一个数字，引擎不用动。
 *
 * 单关结构 = 路长 × 起始兵力 × 英雄 DPS × 数字门 × 丧尸波 × 终点 Boss
 * 队伍推进速度约 118 px/s，5000 px ≈ 42 秒路程，加 Boss 战一局 55–60 秒。
 *
 * 门的设计规则（重要）：
 *   1. 倍率门（×2 / ×3）只放在前 3 个门，因为兵力基数还小，乘完不会炸；
 *      后面全用加减法 —— 一旦在后期放 ×2，总数会直接翻倍，Boss 就没法配平。
 *   2. 好门在左右两侧交替出现，逼玩家一直微调走位；不操作只会拿到一半收益。
 *   3. 坏门只是扣兵，不做「÷N」——60 秒的局，多一种规则就是多一层学习成本。
 *
 * 调参口诀：
 *   - Boss 战时长 ≈ boss.hp / heroDps，目标 16–18 秒
 *   - 进 Boss 段需要的兵力 ≈ boss.eat × 17 秒
 *   - 好路线总兵力 ≈ 起始 × 6 + 各门加和，再扣掉丧尸消耗
 */

export type GateOp = 'add' | 'sub' | 'mul'
export type ZombieKind = 'girl' | 'fast' | 'tank'

export interface GateLane {
  op: GateOp
  value: number
}

export interface GateDef {
  y: number
  /** 1 条 = 全宽（补偿门）；2 条 = 并排二选一 */
  lanes: GateLane[]
}

export interface WaveDef {
  y: number
  count: number
  kind: ZombieKind
  /** 同批丧尸的出场间隔，默认 0.22s */
  gap?: number
}

export interface BossDef {
  hp: number
  /** 每秒吃掉的兵力 */
  eat: number
  /** 是否为「大 Boss」关（第 4 / 8 / 10 关） */
  big: boolean
}

export interface LevelDef {
  id: number
  name: string
  tip: string
  length: number
  startTroops: number
  heroDps: number
  boss: BossDef
  gates: GateDef[]
  waves: WaveDef[]
}

const add = (value: number): GateLane => ({ op: 'add', value })
const sub = (value: number): GateLane => ({ op: 'sub', value })
const mul = (value: number): GateLane => ({ op: 'mul', value })

/** 并排二选一：左 lane / 右 lane */
const two = (y: number, a: GateLane, b: GateLane): GateDef => ({ y, lanes: [a, b] })
const wave = (y: number, count: number, kind: ZombieKind): WaveDef => ({ y, count, kind })

/** 起跑缓冲：队伍从 320 出发，把整张图往后推一段，保证第一个门看得见、来得及选 */
const LEAD = 420

const RAW: LevelDef[] = [
  {
    id: 1,
    name: '城门失守',
    tip: '看准门再滑：红门扣兵，绿门加兵，金门翻倍。',
    length: 5000,
    startTroops: 10,
    heroDps: 100,
    boss: { hp: 1700, eat: 12, big: false },
    gates: [
      two(560, mul(2), add(15)),
      two(980, add(20), sub(5)),
      two(1420, sub(10), mul(3)),
      two(1900, add(25), sub(10)),
      two(2400, sub(15), add(30)),
      two(2900, add(35), sub(15)),
      two(3400, sub(20), add(40)),
      two(3900, add(45), sub(20)),
      two(4300, sub(25), add(50)),
      two(4700, add(55), sub(30)),
    ],
    waves: [
      wave(900, 6, 'girl'),
      wave(1400, 8, 'girl'),
      wave(2000, 5, 'girl'),
      wave(2500, 10, 'girl'),
      wave(3100, 6, 'girl'),
      wave(3110, 2, 'tank'),
      wave(3700, 12, 'girl'),
      wave(4100, 8, 'girl'),
      wave(4110, 3, 'tank'),
    ],
  },
  {
    id: 2,
    name: '绕后',
    tip: '好门开始换边了，眼睛要往远处看。',
    length: 5100,
    startTroops: 10,
    heroDps: 105,
    boss: { hp: 1800, eat: 14, big: false },
    gates: [
      two(560, sub(5), mul(2)),
      two(1000, add(25), sub(5)),
      two(1440, sub(10), mul(3)),
      two(1900, add(30), sub(10)),
      two(2380, sub(15), add(35)),
      two(2860, add(40), sub(15)),
      two(3340, sub(20), add(45)),
      two(3820, add(50), sub(20)),
      two(4260, sub(25), add(55)),
      two(4660, add(60), sub(30)),
    ],
    waves: [
      wave(860, 7, 'girl'),
      wave(1240, 6, 'fast'),
      wave(1720, 10, 'girl'),
      wave(2200, 8, 'girl'),
      wave(2600, 4, 'tank'),
      wave(3000, 12, 'girl'),
      wave(3500, 8, 'fast'),
      wave(3900, 14, 'girl'),
      wave(4300, 5, 'tank'),
    ],
  },
  {
    id: 3,
    name: '快车道',
    tip: '快速丧尸会抢先撞上来，先让英雄点名。',
    length: 5200,
    startTroops: 12,
    heroDps: 110,
    boss: { hp: 1900, eat: 16, big: false },
    gates: [
      two(560, sub(8), mul(2)),
      two(1000, add(30), sub(8)),
      two(1440, sub(12), mul(3)),
      two(1900, add(35), sub(12)),
      two(2380, sub(18), add(40)),
      two(2860, add(45), sub(18)),
      two(3340, sub(22), add(50)),
      two(3820, add(55), sub(22)),
      two(4260, sub(28), add(60)),
      two(4680, add(65), sub(32)),
    ],
    waves: [
      wave(860, 8, 'fast'),
      wave(1240, 8, 'girl'),
      wave(1720, 12, 'girl'),
      wave(2160, 10, 'fast'),
      wave(2620, 5, 'tank'),
      wave(3060, 14, 'girl'),
      wave(3480, 10, 'fast'),
      wave(3920, 16, 'girl'),
      wave(4340, 6, 'tank'),
    ],
  },
  {
    id: 4,
    name: '铁皮指挥',
    tip: '第一个大 Boss。带不够兵，它几秒就能把队伍吃干净。',
    length: 5300,
    startTroops: 14,
    heroDps: 120,
    boss: { hp: 2000, eat: 20, big: true },
    gates: [
      two(560, sub(10), mul(2)),
      two(1000, add(30), sub(10)),
      two(1440, sub(15), mul(3)),
      two(1900, add(40), sub(15)),
      two(2380, sub(20), add(45)),
      two(2860, add(50), sub(20)),
      two(3340, sub(25), add(55)),
      two(3820, add(60), sub(25)),
      two(4260, sub(30), add(65)),
      two(4700, add(70), sub(35)),
    ],
    waves: [
      wave(820, 8, 'girl'),
      wave(1180, 8, 'fast'),
      wave(1640, 12, 'girl'),
      wave(2060, 6, 'tank'),
      wave(2480, 14, 'girl'),
      wave(2900, 12, 'fast'),
      wave(3320, 5, 'tank'),
      wave(3740, 16, 'girl'),
      wave(4120, 8, 'tank'),
      wave(4480, 18, 'girl'),
    ],
  },
  {
    id: 5,
    name: '空投',
    tip: '门给得越来越抠，别为了躲一个 −30 错过一个 +60。',
    length: 5300,
    startTroops: 14,
    heroDps: 130,
    boss: { hp: 2200, eat: 22, big: false },
    gates: [
      two(560, sub(10), mul(2)),
      two(1000, add(35), sub(10)),
      two(1440, sub(15), mul(3)),
      two(1900, add(45), sub(15)),
      two(2380, sub(22), add(50)),
      two(2860, add(55), sub(22)),
      two(3340, sub(28), add(60)),
      two(3820, add(65), sub(28)),
      two(4260, sub(32), add(70)),
      two(4700, add(75), sub(38)),
    ],
    waves: [
      wave(800, 10, 'girl'),
      wave(1160, 10, 'fast'),
      wave(1600, 14, 'girl'),
      wave(2020, 7, 'tank'),
      wave(2440, 16, 'girl'),
      wave(2860, 14, 'fast'),
      wave(3280, 6, 'tank'),
      wave(3700, 18, 'girl'),
      wave(4080, 9, 'tank'),
      wave(4460, 20, 'girl'),
    ],
  },
  {
    id: 6,
    name: '窄桥',
    tip: '队形挤成一团的时候，贴着边走最容易吃错门。',
    length: 5400,
    startTroops: 16,
    heroDps: 140,
    boss: { hp: 2400, eat: 24, big: false },
    gates: [
      two(560, sub(10), mul(2)),
      two(1000, add(40), sub(10)),
      two(1440, sub(18), mul(3)),
      two(1900, add(50), sub(18)),
      two(2380, sub(25), add(55)),
      two(2860, add(60), sub(25)),
      two(3340, sub(30), add(65)),
      two(3820, add(70), sub(30)),
      two(4260, sub(35), add(75)),
      two(4720, add(80), sub(40)),
    ],
    waves: [
      wave(780, 10, 'girl'),
      wave(1140, 12, 'fast'),
      wave(1580, 16, 'girl'),
      wave(2000, 8, 'tank'),
      wave(2420, 18, 'girl'),
      wave(2840, 16, 'fast'),
      wave(3260, 7, 'tank'),
      wave(3680, 20, 'girl'),
      wave(4060, 10, 'tank'),
      wave(4440, 22, 'girl'),
      wave(4800, 12, 'fast'),
    ],
  },
  {
    id: 7,
    name: '尸潮',
    tip: '这一关的丧尸比门多，宁可多拿兵，别贪倍率。',
    length: 5400,
    startTroops: 16,
    heroDps: 150,
    boss: { hp: 2600, eat: 26, big: false },
    gates: [
      two(560, sub(12), mul(2)),
      two(1000, add(45), sub(12)),
      two(1440, sub(20), mul(3)),
      two(1900, add(55), sub(20)),
      two(2380, sub(28), add(60)),
      two(2860, add(65), sub(28)),
      two(3340, sub(32), add(70)),
      two(3820, add(75), sub(32)),
      two(4260, sub(38), add(80)),
      two(4720, add(85), sub(42)),
    ],
    waves: [
      wave(780, 12, 'girl'),
      wave(1140, 14, 'fast'),
      wave(1580, 18, 'girl'),
      wave(2000, 10, 'tank'),
      wave(2420, 20, 'girl'),
      wave(2840, 18, 'fast'),
      wave(3260, 8, 'tank'),
      wave(3680, 22, 'girl'),
      wave(4060, 12, 'tank'),
      wave(4440, 24, 'girl'),
      wave(4800, 14, 'fast'),
    ],
  },
  {
    id: 8,
    name: '钢铁洪流',
    tip: '第二个大 Boss。从这里开始，选错门是真的会死。',
    length: 5500,
    startTroops: 18,
    heroDps: 165,
    boss: { hp: 2900, eat: 30, big: true },
    gates: [
      two(560, sub(12), mul(2)),
      two(1000, add(50), sub(12)),
      two(1440, sub(22), mul(3)),
      two(1900, add(60), sub(22)),
      two(2380, sub(30), add(65)),
      two(2860, add(70), sub(30)),
      two(3340, sub(35), add(75)),
      two(3820, add(80), sub(35)),
      two(4260, sub(40), add(85)),
      two(4740, add(90), sub(45)),
    ],
    waves: [
      wave(760, 12, 'fast'),
      wave(1120, 16, 'girl'),
      wave(1560, 20, 'girl'),
      wave(1980, 11, 'tank'),
      wave(2400, 22, 'girl'),
      wave(2820, 20, 'fast'),
      wave(3240, 9, 'tank'),
      wave(3660, 24, 'girl'),
      wave(4040, 13, 'tank'),
      wave(4420, 26, 'girl'),
      wave(4780, 16, 'fast'),
    ],
  },
  {
    id: 9,
    name: '最后补给',
    tip: '带着足够的兵见 Boss，比打出最高数字更重要。',
    length: 5500,
    startTroops: 20,
    heroDps: 180,
    boss: { hp: 3100, eat: 33, big: false },
    gates: [
      two(560, sub(14), mul(2)),
      two(1000, add(55), sub(14)),
      two(1440, sub(24), mul(3)),
      two(1900, add(65), sub(24)),
      two(2380, sub(32), add(70)),
      two(2860, add(75), sub(32)),
      two(3340, sub(38), add(80)),
      two(3820, add(85), sub(38)),
      two(4260, sub(42), add(90)),
      two(4740, add(95), sub(48)),
    ],
    waves: [
      wave(740, 14, 'fast'),
      wave(1100, 18, 'girl'),
      wave(1540, 22, 'girl'),
      wave(1960, 12, 'tank'),
      wave(2380, 24, 'girl'),
      wave(2800, 22, 'fast'),
      wave(3220, 10, 'tank'),
      wave(3640, 26, 'girl'),
      wave(4020, 14, 'tank'),
      wave(4400, 28, 'girl'),
      wave(4760, 18, 'fast'),
    ],
  },
  {
    id: 10,
    name: '无尽火线',
    tip: '最后一关。所有数字都摊在牌桌上了。',
    length: 5600,
    startTroops: 22,
    heroDps: 200,
    boss: { hp: 3400, eat: 36, big: true },
    gates: [
      two(560, sub(14), mul(2)),
      two(1000, add(60), sub(14)),
      two(1440, sub(26), mul(3)),
      two(1900, add(70), sub(26)),
      two(2380, sub(35), add(75)),
      two(2860, add(80), sub(35)),
      two(3340, sub(40), add(85)),
      two(3820, add(90), sub(40)),
      two(4260, sub(45), add(95)),
      two(4720, add(100), sub(50)),
      two(5200, add(110), sub(55)),
    ],
    waves: [
      wave(720, 16, 'fast'),
      wave(1080, 20, 'girl'),
      wave(1520, 24, 'girl'),
      wave(1940, 14, 'tank'),
      wave(2360, 26, 'girl'),
      wave(2780, 24, 'fast'),
      wave(3200, 12, 'tank'),
      wave(3620, 28, 'girl'),
      wave(4000, 16, 'tank'),
      wave(4380, 30, 'girl'),
      wave(4740, 20, 'fast'),
      wave(5100, 18, 'tank'),
    ],
  },
]

/** 统一加上起跑缓冲：数据里写的 y 都从「出发瞬间」算起，手调时不用心算偏移 */
export const LEVELS: LevelDef[] = RAW.map((lv) => ({
  ...lv,
  length: lv.length + LEAD,
  gates: lv.gates.map((g) => ({ ...g, y: g.y + LEAD })),
  waves: lv.waves.map((w) => ({ ...w, y: w.y + LEAD })),
}))

export const MAX_LEVEL = LEVELS.length

export function getLevel(id: number): LevelDef {
  const found = LEVELS.find((l) => l.id === id)
  return found ?? (LEVELS[0] as LevelDef)
}
