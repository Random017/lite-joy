import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:5199/lite-joy/'
const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 900, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.getByText('让子弹射').first().click()
await page.getByRole('button', { name: '开始游戏' }).click()
const canvas = page.locator('canvas.stage-canvas')
await canvas.waitFor()
await page.waitForTimeout(600)

const rect = await canvas.boundingBox()
const scale = rect.width / 720
const at = (x, y) => ({ x: rect.x + x * scale, y: rect.y + y * scale })

// 火力卡（逻辑坐标 200,675）：钱不够应静默失败，且不能误判成长按战场
const card = at(200, 675)
await page.mouse.move(card.x, card.y)
await page.mouse.down()
await page.waitForTimeout(150)
const afterCard = await page.evaluate(() => window.__ammoGame.getState())
await page.mouse.up()

// 战场（150,120）：应进入 holding
const field = at(150, 120)
await page.mouse.move(field.x, field.y)
await page.mouse.down()
await page.waitForTimeout(150)
const afterField = await page.evaluate(() => window.__ammoGame.getState())
await page.mouse.up()
await page.waitForTimeout(150)
const afterUp = await page.evaluate(() => window.__ammoGame.getState())

console.log(JSON.stringify({
  rect,
  cardHitNotHolding: afterCard.holding === false,
  cardCoins: afterCard.coins,
  fieldHolding: afterField.holding,
  releasedHolding: afterUp.holding,
  errors,
}, null, 2))

await browser.close()
