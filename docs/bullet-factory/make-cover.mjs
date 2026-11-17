// 从接入后的页面抓一张画布截图，裁出战场区当开始页横幅
// 用法：先起 dev/preview，再 node docs/bullet-factory/make-cover.mjs
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:5173/lite-joy/'

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.getByText('让子弹射').first().click()
await page.getByRole('button', { name: '开始游戏' }).click()

const canvas = page.locator('canvas.stage-canvas')
await canvas.waitFor()
// 等到有交火（弹道 / 伤害数字）再截
await page.waitForTimeout(7000)
await canvas.screenshot({ path: 'docs/bullet-factory/assets/cover-raw.png' })
await browser.close()
console.log('ok: docs/bullet-factory/assets/cover-raw.png')