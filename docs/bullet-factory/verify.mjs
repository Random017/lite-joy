// 原型冒烟：截图 + 关键交互断言
// 用法：node docs/bullet-factory/verify.mjs
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(dir, 'prototype.html');
const out = (name) => path.join(dir, 'assets', name);

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 460, height: 900 }, deviceScaleFactor: 2 });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto('file:///' + file.replace(/\\/g, '/'));
const box = await page.locator('#stage').boundingBox();
// 逻辑坐标 (720x1280) → 屏幕坐标
const at = (lx, ly) => ({ x: box.x + box.width * (lx / 720), y: box.y + box.height * (ly / 1280) });
const state = () => page.evaluate(() => {
  const g = window.__game.state;
  return { wave: g.wave, hp: g.hp, ammo: g.ammo, coins: g.coins, kills: g.kills, over: g.over };
});

const checks = {};

// 1) 静音开关
const mute = at(680, 450);
await page.mouse.click(mute.x, mute.y);
checks.muted = await page.evaluate(() => window.__game.state.muted);
await page.mouse.click(mute.x, mute.y);
checks.unmuted = await page.evaluate(() => window.__game.state.muted);

// 2) 买不起的卡不扣钱
const before = (await state()).coins;
const card = at(130, 676);
await page.mouse.click(card.x, card.y);
checks.coinsUnchangedWhenPoor = (await state()).coins === before;

// 3) 长按进入倾泻模式
const field = at(300, 160);
await page.mouse.move(field.x, field.y);
await page.mouse.down();
await page.waitForTimeout(600);
checks.holding = await page.evaluate(() => window.__game.state.holding);
await page.mouse.up();
checks.released = !(await page.evaluate(() => window.__game.state.holding));

// 4) 自动开火 9 秒 → 截图（尸潮压境）
await page.waitForTimeout(8600);
await page.screenshot({ path: out('shot-1.jpg'), type: 'jpeg', quality: 88 });
checks.afterIdle = await state();

// 5) 长按倾泻 2 秒 → 截图
await page.mouse.move(field.x, field.y);
await page.mouse.down();
await page.waitForTimeout(2000);
await page.mouse.up();
await page.waitForTimeout(120);
await page.screenshot({ path: out('shot-2.jpg'), type: 'jpeg', quality: 88 });

// 6) 升满 → 截图
await page.evaluate(() => {
  const g = window.__game.state;
  g.coins += 900;
  window.__game.buy('dmg'); window.__game.buy('dmg');
  window.__game.buy('belt'); window.__game.buy('belt');
  window.__game.buy('gate');
});
await page.waitForTimeout(2500);
await page.screenshot({ path: out('shot-3.jpg'), type: 'jpeg', quality: 88 });
checks.afterUpgrade = await page.evaluate(() => ({
  dmg: window.__game.state.damage, mult: window.__game.state.beltMult
}));

checks.consoleErrors = errors;
console.log(JSON.stringify(checks, null, 2));
await browser.close();
