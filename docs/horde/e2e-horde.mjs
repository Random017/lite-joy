/* 无尽火线 · 端到端冒烟
 *
 * 用一个「贪心机器人」把某一关从头打到尾：它只做一件人类玩家会做的事 ——
 * 看远处那道门，把队伍滑到收益更高的那一侧。
 *
 * 顺带验证：画面真的画出来了、控制台没报错、兵力会因为门涨起来、一局能分出胜负。
 *
 * 用法（先 npm run dev）：
 *   node docs/horde/e2e-horde.mjs        # 默认第 1 关
 *   node docs/horde/e2e-horde.mjs 4      # 指定关卡
 *   $env:BASE_URL='http://127.0.0.1:4173/lite-joy/'; node docs/horde/e2e-horde.mjs
 */

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173/lite-joy/'
const OUT = 'test-artifacts/horde'
const LEVEL = Number(process.argv[2] ?? 1)
const TIMEOUT_MS = 150_000

mkdirSync(OUT, { recursive: true })

const fail = (msg) => {
  console.error(`FAIL ${msg}`)
  process.exit(1)
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 })

const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push(e.message))

const state = () => page.evaluate(() => window.__hordeGame?.getState() ?? null)

await page.addInitScript(() => localStorage.setItem('lite-joy.horde.unlocked', '99'))
await page.goto(BASE, { waitUntil: 'networkidle' })

await page.locator('.game-card', { hasText: '无尽火线' }).click()
await page.waitForTimeout(250)
await page.evaluate((lv) => {
  const btn = document.querySelectorAll('.level')[lv - 1]
  if (btn) btn.click()
}, LEVEL)
await page.waitForTimeout(120)
await page.locator('.start-btn').click()
await page.waitForTimeout(600)

const plan = await page.evaluate(() => window.__hordePlan)
if (!plan) fail('拿不到关卡数据（__hordePlan 为空），是不是没跑在 dev 模式？')

const first = await state()
if (!first) fail('引擎没起来：__hordeGame.getState() 返回空')
if (first.level !== LEVEL) fail(`起的是第 ${first.level} 关，期望第 ${LEVEL} 关`)

// 画面真的画了东西吗
const painted = await page.evaluate(() => {
  const cv = document.querySelector('canvas')
  if (!cv) return 0
  const data = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data
  let n = 0
  for (let i = 3; i < data.length; i += 2000) if (data[i] > 0) n++
  return n
})
if (painted < 50) fail(`canvas 几乎是空的（采样到 ${painted} 个非透明像素）`)

const box = await page.locator('canvas').boundingBox()
const cy = box.y + box.height * 0.82
const score = (lane) => (lane.op === 'mul' ? 1e6 : lane.op === 'add' ? lane.value : -lane.value)

let side = null
async function steer(next) {
  const x = box.x + box.width * (next === 'L' ? 0.24 : 0.76)
  await page.mouse.move(x, cy)
  await page.mouse.down()
  await page.mouse.up()
  side = next
}

const t0 = Date.now()
let last = first
let bossTroops = null
let peak = first.troops

while (Date.now() - t0 < TIMEOUT_MS) {
  const s = await state()
  if (!s) break
  last = s
  peak = Math.max(peak, s.troops)
  if (s.over) break

  const y = s.progress * plan.length
  const gate = plan.gates.find((g) => g.y > y)
  if (gate && gate.y - y < 700) {
    const want = score(gate.lanes[1]) > score(gate.lanes[0]) ? 'R' : 'L'
    if (want !== side) await steer(want)
  }
  if (bossTroops === null && s.bossHp < s.bossMax) {
    bossTroops = s.troops
    await page.screenshot({ path: `${OUT}/level${LEVEL}-boss.png` })
  }
  await page.waitForTimeout(100)
}

await page.screenshot({ path: `${OUT}/level${LEVEL}-end.png` })
await browser.close()

console.log(`第 ${LEVEL} 关 ${last.levelName}`)
console.log(`  进 Boss 时兵力 ${bossTroops ?? '—'}，峰值 ${peak}，结束 ${last.troops}，耗时 ${Math.round((Date.now() - t0) / 1000)}s`)
console.log(`  结果 ${last.over ?? '超时'}，Boss 剩 ${last.bossHp}/${last.bossMax}`)

if (errors.length) fail(`控制台有 ${errors.length} 条报错：\n${errors.join('\n')}`)
if (peak <= first.troops) fail('兵力全程没涨，数字门没生效')
if (!last.over) fail('一局没有结束，可能是卡住了')
if (last.over !== 'win') fail(`贪心走位仍打输了（进 Boss 兵力 ${bossTroops}），数值可能需要调`)

console.log('PASS')
