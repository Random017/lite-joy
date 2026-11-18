/* 重新生成 docs/horde/assets/ 里的三张截图
 *
 * 用法（先 npm run dev）：
 *   node docs/horde/make-shot.mjs
 *
 * 它会用贪心走位把第 4 关打一遍，挑「路上」和「Boss 战」两个时刻截 canvas，
 * 最后再截一张开始页。改完美术想更新文档配图时跑这个就行。
 */

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173/lite-joy/'
const OUT = 'docs/horde/assets'
const LEVEL = 4

mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 })
await page.addInitScript(() => localStorage.setItem('lite-joy.horde.unlocked', '99'))

const shot = (path) => page.locator('.stage-canvas').screenshot({ path, type: 'jpeg', quality: 86 })
const state = () => page.evaluate(() => window.__hordeGame?.getState() ?? null)

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.locator('.game-card', { hasText: '无尽火线' }).click()
await page.waitForTimeout(300)
await page.evaluate((lv) => document.querySelectorAll('.level')[lv - 1]?.click(), LEVEL)
await page.waitForTimeout(120)

await page.screenshot({ path: `${OUT}/shot-start.jpg`, type: 'jpeg', quality: 86 })
await page.locator('.start-btn').click()
await page.waitForTimeout(500)

const plan = await page.evaluate(() => window.__hordePlan)
const box = await page.locator('canvas').boundingBox()
const cy = box.y + box.height * 0.82
const score = (lane) => (lane.op === 'mul' ? 1e6 : lane.op === 'add' ? lane.value : -lane.value)

let side = null
async function steer(next) {
  await page.mouse.move(box.x + box.width * (next === 'L' ? 0.24 : 0.76), cy)
  await page.mouse.down()
  await page.mouse.up()
  side = next
}

const t0 = Date.now()
let gates = false
let boss = false

while (Date.now() - t0 < 120_000) {
  const s = await state()
  if (!s || s.over) break

  const y = s.progress * plan.length
  const gate = plan.gates.find((g) => g.y > y)
  if (gate && gate.y - y < 700) {
    const want = score(gate.lanes[1]) > score(gate.lanes[0]) ? 'R' : 'L'
    if (want !== side) await steer(want)
  }

  if (!gates && (Date.now() - t0) / 1000 > 20) {
    gates = true
    await shot(`${OUT}/shot-gates.jpg`)
  }
  if (!boss && s.bossHp < s.bossMax * 0.55) {
    boss = true
    await shot(`${OUT}/shot-boss.jpg`)
    break
  }
  await page.waitForTimeout(100)
}

await browser.close()

if (!gates || !boss) {
  console.error('没截到想要的画面，可能需要调时间点')
  process.exit(1)
}
console.log('已更新 docs/horde/assets/shot-start.jpg / shot-gates.jpg / shot-boss.jpg')