import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5199/lite-joy/'
const OUT = 'test-artifacts/ammo'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'msedge' })
const errors = []

async function run(viewport, tag) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 })
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${tag}] ${m.text()}`) })
  page.on('pageerror', (e) => errors.push(`[${tag}] ${e.message}`))

  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: '让子弹射' }).waitFor({ timeout: 10000 })
  if (tag === 'desktop') {
    await page.screenshot({ path: `${OUT}/home.png` })
  }

  await page.getByText('让子弹射').first().click()
  await page.getByRole('button', { name: '开始游戏' }).waitFor()
  await page.waitForFunction(() => {
    const img = document.querySelector('img.cover')
    return !!img && img.complete && img.naturalWidth > 0
  }, null, { timeout: 10000 })
  await page.screenshot({ path: `${OUT}/${tag}-start.png` })

  const metrics = await page.evaluate(() => ({
    scrollH: document.documentElement.scrollHeight,
    innerH: window.innerHeight,
    appRect: (() => { const r = document.querySelector('#app').getBoundingClientRect(); return { w: r.width, h: r.height, x: r.x, y: r.y } })(),
    containerRect: (() => { const r = document.querySelector('.game-container').getBoundingClientRect(); return { w: r.width, h: r.height, y: r.y } })(),
    coverBox: (() => { const r = document.querySelector('img.cover').getBoundingClientRect(); return { w: r.width, h: r.height } })(),
  }))

  const before = { box: await page.locator('.stage-wrap').boundingBox() }

  await page.getByRole('button', { name: '开始游戏' }).click()
  const canvas = page.locator('canvas.stage-canvas')
  await canvas.waitFor()
  const cbox = await canvas.boundingBox()

  await page.waitForTimeout(2600)
  await page.screenshot({ path: `${OUT}/${tag}-play.png` })

  const state1 = await page.evaluate(() => window.__ammoGame?.getState() ?? null)

  // 长按战场 -> holding
  await page.mouse.move(cbox.x + cbox.width / 2, cbox.y + cbox.height * 0.12)
  await page.mouse.down()
  await page.waitForTimeout(120)
  const holding = await page.evaluate(() => window.__ammoGame?.getState().holding ?? null)
  await page.mouse.up()
  await page.waitForTimeout(120)
  const released = await page.evaluate(() => window.__ammoGame?.getState().holding ?? null)

  await page.waitForTimeout(1500)
  const state2 = await page.evaluate(() => window.__ammoGame?.getState() ?? null)

  await page.close()
  return { tag, viewport, metrics, before, canvas: cbox, state1, state2, holding, released }
}

const desktop = await run({ width: 1280, height: 800 }, 'desktop')
const mobile = await run({ width: 390, height: 844 }, 'mobile')

await browser.close()
console.log(JSON.stringify({ desktop, mobile, errors }, null, 2))
