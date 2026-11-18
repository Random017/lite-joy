/* 无尽火线 —— 竖屏单局：人群推进 + 数字门
 *
 * 纯 Canvas 引擎：不依赖 Vue、不碰路由，只吃一个 <canvas>。
 * 逻辑分辨率固定 720×1280（9:16），实际像素按 devicePixelRatio 放大，CSS 负责等比缩放。
 *
 * 一局的因果链：
 *   左右滑动 → 队伍平移 → 穿过并排数字门（+N / ×N / −N）→ 兵力变化
 *   英雄在队首自动索敌开火，打掉来得及的；漏过来的丧尸按 eat 值吃掉兵力
 *   终点 Boss：英雄的子弹持续输出，Boss 持续吃兵 —— 谁先归零谁输
 *
 * 所以「兵 = 时间」，「英雄 = 计时器」，门上那个数字就是你还能活多久。
 */

import {
  LEVELS,
  MAX_LEVEL,
  getLevel,
  type GateDef,
  type LevelDef,
  type ZombieKind,
} from './levels'

const W = 720
const H = 1280
const ROAD_L = 96
const ROAD_R = 624
const CENTER = (ROAD_L + ROAD_R) / 2
const SQUAD_MIN = ROAD_L + 150
const SQUAD_MAX = ROAD_R - 150

const SPEED = 118          // 队伍推进速度 px/s
const CAM_LAG = 300        // 队伍固定在屏幕下方 300px 处
const SQ_START_Y = 320     // 出发位置（世界坐标）
const SP_X = 14            // 队形横向间距
const SP_Y = 12            // 队形纵向间距
const MAX_BODY = 380       // 最多画多少个兵（再多就只显示数字）
const HERO_INT = 0.3       // 英雄开火间隔
const HERO_RANGE = 560
const BOSS_STOP = 70       // 在 Boss 前多少 px 停下

type Over = null | 'win' | 'lose'

interface Bol {
  x: number
  y: number
  vx: number
  vy: number
  dmg: number
}

interface Zed {
  x: number
  y: number
  hp: number
  max: number
  kind: ZombieKind
  spd: number
  ph: number
  flash: number
}

interface Part {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  color: string
  r: number
  z: number
}

interface Flo {
  x: number
  y: number
  str: string
  color: string
  size: number
  life: number
  max: number
}

interface Boss {
  hp: number
  max: number
  eat: number
  big: boolean
  ph: number
  flash: number
  engaged: boolean
  hitY: number
}

interface Pending {
  t: number
  kind: ZombieKind
}

export interface HordeState {
  level: number
  levelName: string
  troops: number
  bossHp: number
  bossMax: number
  heroDps: number
  progress: number
  lane: number
  over: Over
  muted: boolean
}

export interface HordeEvent {
  type: 'win' | 'lose'
  level: number
}

export interface HordeGameHandle {
  start: () => void
  destroy: () => void
  restart: (levelId?: number) => void
  toggleMute: () => void
  getState: () => HordeState
}

export interface HordeGameOptions {
  level?: number
  onState?: (state: HordeState) => void
  onEvent?: (event: HordeEvent) => void
}

const ZED: Record<ZombieKind, { hp: number; spd: number; r: number; eat: number; body: string; skin: string }> = {
  girl: { hp: 26, spd: 96, r: 15, eat: 1, body: '#5d9b48', skin: '#b9d68a' },
  fast: { hp: 20, spd: 156, r: 13, eat: 1, body: '#7a8f3a', skin: '#c8de8e' },
  tank: { hp: 78, spd: 58, r: 23, eat: 4, body: '#3f6b4a', skin: '#8fae6a' },
}

export function createHordeGame(cv: HTMLCanvasElement, options: HordeGameOptions = {}): HordeGameHandle {
  const ctx = cv.getContext('2d') as CanvasRenderingContext2D
  if (!ctx) throw new Error('canvas 2d context unavailable')

  const abort = new AbortController()

  let dpr = 1
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    cv.width = Math.round(W * dpr)
    cv.height = Math.round(H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()
  const onResize = () => resize()
  window.addEventListener('resize', onResize)

  const C = {
    ink: '#0d1420',
    road: '#2a3442',
    roadDark: '#1d2531',
    roadLine: 'rgba(255,255,255,.10)',
    wall: '#161d27',
    wallHi: '#26313f',
    add: '#25a866',
    addDark: '#15703f',
    mul: '#e0a12c',
    mulDark: '#8f6212',
    sub: '#c0392b',
    subDark: '#7a2318',
    hero: '#63b6ff',
    fire: '#ffd24a',
    white: '#f4f7fb',
    dim: 'rgba(244,247,251,.55)',
  }

  /* ============================================================
     1. 工具
     ============================================================ */
  const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
  const rand = (a: number, b: number) => a + Math.random() * (b - a)

  function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)
    g.beginPath()
    g.moveTo(x + r, y)
    g.arcTo(x + w, y, x + w, y + h, r)
    g.arcTo(x + w, y + h, x, y + h, r)
    g.arcTo(x, y + h, x, y, r)
    g.arcTo(x, y, x + w, y, r)
    g.closePath()
  }

  function label(s: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign = 'center', weight = 800) {
    ctx.font = `${weight} ${size}px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`
    ctx.textAlign = align
    ctx.textBaseline = 'middle'
    ctx.fillStyle = fill
    ctx.fillText(s, x, y)
  }

  /* ============================================================
     2. 精灵预渲染（每帧 drawImage 比每帧画路径快一个量级）
     ============================================================ */
  function makeCanvas(w: number, h: number) {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  }

  const SOLDIER = (() => {
    const c = makeCanvas(28, 36)
    const g = c.getContext('2d')
    if (!g) return c
    g.fillStyle = 'rgba(0,0,0,.30)'
    g.beginPath()
    g.ellipse(14, 32, 8, 3.6, 0, 0, Math.PI * 2)
    g.fill()
    // 身体
    g.fillStyle = '#3f7cc4'
    rr(g, 8, 15, 12, 13, 4)
    g.fill()
    // 高光
    g.fillStyle = 'rgba(255,255,255,.32)'
    rr(g, 9.5, 16.5, 3.6, 8, 1.8)
    g.fill()
    // 头盔
    g.fillStyle = '#2c5c9c'
    g.beginPath()
    g.arc(14, 12, 6.4, Math.PI, 0)
    g.fill()
    g.fillRect(7.4, 11.6, 13.2, 2.4)
    // 脸
    g.fillStyle = '#f2dcba'
    g.beginPath()
    g.arc(14, 13.4, 4, 0, Math.PI * 2)
    g.fill()
    return c
  })()

  const ROAD_TILE = (() => {
    const c = makeCanvas(W, H)
    const g = c.getContext('2d')
    if (!g) return c
    const bg = g.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#20293a')
    bg.addColorStop(0.5, '#243042')
    bg.addColorStop(1, '#1b2331')
    g.fillStyle = bg
    g.fillRect(0, 0, W, H)

    // 路面
    g.fillStyle = C.road
    g.fillRect(ROAD_L, 0, ROAD_R - ROAD_L, H)
    g.fillStyle = C.roadDark
    g.fillRect(ROAD_L, 0, 10, H)
    g.fillRect(ROAD_R - 10, 0, 10, H)

    // 中线虚线
    g.strokeStyle = C.roadLine
    g.lineWidth = 8
    g.setLineDash([46, 40])
    g.beginPath()
    g.moveTo(CENTER, 0)
    g.lineTo(CENTER, H)
    g.stroke()
    g.setLineDash([])

    // 纵向纹理
    for (let i = 0; i < 90; i++) {
      const x = rand(ROAD_L + 14, ROAD_R - 14)
      const y = rand(0, H)
      g.fillStyle = `rgba(255,255,255,${rand(0.012, 0.04).toFixed(3)})`
      g.fillRect(x, y, rand(2, 6), rand(10, 40))
    }
    // 碎石
    for (let i = 0; i < 40; i++) {
      const x = rand(ROAD_L + 18, ROAD_R - 18)
      const y = rand(0, H)
      g.fillStyle = `rgba(0,0,0,${rand(0.12, 0.3).toFixed(3)})`
      g.beginPath()
      g.ellipse(x, y, rand(3, 8), rand(2, 4), 0, 0, Math.PI * 2)
      g.fill()
    }
    return c
  })()

  /* ============================================================
     3. 音效
     ============================================================ */
  let actx: AudioContext | null = null
  function beep(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.04, slide = 0) {
    if (S.muted) return
    try {
      if (!actx) actx = new AudioContext()
      if (actx.state === 'suspended') void actx.resume()
      const t0 = actx.currentTime
      const o = actx.createOscillator()
      const gn = actx.createGain()
      o.type = type
      o.frequency.setValueAtTime(freq, t0)
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur)
      gn.gain.setValueAtTime(vol, t0)
      gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
      o.connect(gn)
      gn.connect(actx.destination)
      o.start(t0)
      o.stop(t0 + dur + 0.02)
    } catch {
      /* 忽略 */
    }
  }

  /* ============================================================
     4. 运行态
     ============================================================ */
  function freshRun(levelId: number) {
    const lv = getLevel(levelId)
    return {
      lv,
      troops: lv.startTroops,
      squadX: CENTER,
      targetX: CENTER,
      squadY: SQ_START_Y,
      time: 0,
      over: null as Over,
      overT: 0,
      boss: {
        hp: lv.boss.hp,
        max: lv.boss.hp,
        eat: lv.boss.eat,
        big: lv.boss.big,
        ph: 0,
        flash: 0,
        engaged: false,
        hitY: lv.length,
      } as Boss,
      gateIdx: 0,
      waveIdx: 0,
      pending: [] as Pending[],
      zeds: [] as Zed[],
      bols: [] as Bol[],
      parts: [] as Part[],
      flos: [] as Flo[],
      heroCd: 0,
      heroKick: 0,
      shake: 0,
      hurt: 0,
      muted: false,
      eatAcc: 0,
      gateFlash: 0,
      gateColor: C.mul,
      kills: 0,
    }
  }

  let S = freshRun(options.level ?? 1)
  let camY = 0

  const screenY = (wy: number) => H - (wy - camY)
  const screenX = (wx: number) => wx

  /* ============================================================
     5. 特效
     ============================================================ */
  function burst(x: number, y: number, n: number, color: string, spread = 90, life = 0.45, size = 4) {
    for (let i = 0; i < n; i++) {
      S.parts.push({
        x,
        y,
        vx: rand(-spread, spread),
        vy: rand(-spread, spread),
        life: rand(life * 0.6, life),
        max: life,
        color,
        r: rand(size * 0.5, size),
        z: 0,
      })
    }
  }

  function floatText(x: number, y: number, str: string, color: string, size = 34) {
    S.flos.push({ x, y, str, color, size, life: 0.9, max: 0.9 })
  }

  /* ============================================================
     6. 门
     ============================================================ */
  function applyGate(g: GateDef) {
    const lanes = g.lanes
    const idx = lanes.length <= 1 ? 0 : S.squadX < CENTER ? 0 : 1
    const lane = lanes[idx]
    if (!lane) return

    const before = S.troops
    if (lane.op === 'add') S.troops = Math.min(9999, S.troops + lane.value)
    else if (lane.op === 'sub') S.troops = Math.max(0, S.troops - lane.value)
    else S.troops = Math.min(9999, S.troops * lane.value)

    const delta = S.troops - before
    const color = lane.op === 'mul' ? C.mul : lane.op === 'add' ? C.add : C.sub
    S.gateFlash = 1
    S.gateColor = color
    S.heroKick = 1

    const str = lane.op === 'mul' ? `×${lane.value}` : `${delta >= 0 ? '+' : ''}${delta}`
    floatText(S.squadX, S.squadY + 70, str, color, lane.op === 'mul' ? 58 : 44)
    burst(S.squadX, S.squadY + 20, lane.op === 'sub' ? 10 : 16, color, 130, 0.5, 5)

    beep(lane.op === 'sub' ? 180 : lane.op === 'mul' ? 520 : 420, 0.09, 'square', 0.05, lane.op === 'sub' ? -60 : 180)

    if (S.troops <= 0) finish('lose')
  }

  /* ============================================================
     7. 丧尸 / 波次
     ============================================================ */
  function spawnZed(kind: ZombieKind) {
    const base = ZED[kind]
    const x = clamp(S.squadX + rand(-190, 190), ROAD_L + 36, ROAD_R - 36)
    const y = Math.min(S.squadY + 1040, S.lv.length - 120)
    S.zeds.push({
      x,
      y,
      hp: base.hp,
      max: base.hp,
      kind,
      spd: base.spd,
      ph: rand(0, Math.PI * 2),
      flash: 0,
    })
  }

  function feed() {
    const wave = S.lv.waves[S.waveIdx]
    if (!wave) return
    if (S.squadY < wave.y) return
    const gap = wave.gap ?? 0.22
    for (let i = 0; i < wave.count; i++) S.pending.push({ t: i * gap, kind: wave.kind })
    S.waveIdx++
  }

  /* ============================================================
     8. 输入
     ============================================================ */
  function pointerToWorld(clientX: number) {
    const r = cv.getBoundingClientRect()
    if (r.width <= 0) return CENTER
    const lx = ((clientX - r.left) / r.width) * W
    return clamp(lx, SQUAD_MIN, SQUAD_MAX)
  }

  function onDown(e: PointerEvent) {
    e.preventDefault()
    if (S.over) {
      tapOverlay()
      return
    }
    S.targetX = pointerToWorld(e.clientX)
  }

  function onMove(e: PointerEvent) {
    if (!e.buttons && e.pointerType === 'mouse') return
    S.targetX = pointerToWorld(e.clientX)
  }

  cv.addEventListener('pointerdown', onDown, { signal: abort.signal })
  cv.addEventListener('pointermove', onMove, { signal: abort.signal })
  cv.addEventListener('contextmenu', (e) => e.preventDefault(), { signal: abort.signal })

  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') S.targetX = clamp(S.targetX - 90, SQUAD_MIN, SQUAD_MAX)
    else if (e.key === 'ArrowRight') S.targetX = clamp(S.targetX + 90, SQUAD_MIN, SQUAD_MAX)
    else if (e.key === 'r' || e.key === 'R') restart()
  }
  window.addEventListener('keydown', onKey, { signal: abort.signal })

  /* ============================================================
     9. 更新
     ============================================================ */
  function finish(kind: 'win' | 'lose') {
    if (S.over) return
    S.over = kind
    S.overT = 0
    S.shake = 18
    if (kind === 'win') {
      beep(523, 0.12, 'square', 0.06, 120)
      window.setTimeout(() => beep(784, 0.18, 'square', 0.06, 160), 110)
      options.onEvent?.({ type: 'win', level: S.lv.id })
    } else {
      beep(180, 0.35, 'sawtooth', 0.06, -120)
      options.onEvent?.({ type: 'lose', level: S.lv.id })
    }
  }

  function update(dt: number) {
    S.time += dt
    S.shake = Math.max(0, S.shake - dt * 55)
    S.hurt = Math.max(0, S.hurt - dt * 2.2)
    S.gateFlash = Math.max(0, S.gateFlash - dt * 2.4)
    S.heroKick = Math.max(0, S.heroKick - dt * 6)
    S.boss.ph += dt
    S.boss.flash = Math.max(0, S.boss.flash - dt * 11)

    if (S.over) {
      S.overT += dt
      stepParticles(dt)
      return
    }

    // 横向平移
    S.squadX += (S.targetX - S.squadX) * Math.min(1, dt * 14)

    const stopY = S.lv.length - BOSS_STOP
    if (S.squadY < stopY) {
      S.squadY = Math.min(stopY, S.squadY + SPEED * dt)
    } else {
      S.boss.engaged = true
    }

    // 门
    while (S.gateIdx < S.lv.gates.length) {
      const g = S.lv.gates[S.gateIdx]
      if (!g || g.y > S.squadY) break
      applyGate(g)
      S.gateIdx++
      if (S.over) return
    }

    // 波次
    feed()
    for (let i = S.pending.length - 1; i >= 0; i--) {
      const p = S.pending[i]
      if (!p) continue
      p.t -= dt
      if (p.t <= 0) {
        spawnZed(p.kind)
        S.pending.splice(i, 1)
      }
    }

    // 丧尸推进 + 撞队
    const front = S.squadY + 10
    for (let i = S.zeds.length - 1; i >= 0; i--) {
      const z = S.zeds[i]
      if (!z) continue
      z.ph += dt * 6
      z.y -= z.spd * dt
      z.x += Math.sin(z.ph) * 14 * dt
      z.flash = Math.max(0, z.flash - dt * 8)
      if (z.y <= front) {
        const base = ZED[z.kind]
        S.troops = Math.max(0, S.troops - base.eat)
        S.hurt = 1
        S.shake = Math.min(12, S.shake + 4)
        burst(z.x, z.y, 10, '#7fbf5a', 110, 0.4, 4)
        beep(140, 0.06, 'square', 0.035, -40)
        S.zeds.splice(i, 1)
        if (S.troops <= 0) {
          finish('lose')
          return
        }
      }
    }

    // 英雄开火：Boss 战优先打 Boss，否则打最近的丧尸
    S.heroCd -= dt
    if (S.heroCd <= 0) {
      const hx = S.squadX
      const hy = S.squadY + 34
      let tx = 0
      let ty = 0
      let found = false

      if (S.boss.engaged && S.boss.hp > 0) {
        tx = CENTER
        ty = S.boss.hitY - 40
        found = true
      } else {
        let bestD = HERO_RANGE
        for (const z of S.zeds) {
          if (z.y < S.squadY + 20) continue
          const d = Math.hypot(z.x - hx, z.y - hy)
          if (d < bestD) {
            bestD = d
            tx = z.x
            ty = z.y
            found = true
          }
        }
      }

      if (found) {
        const dx = tx - hx
        const dy = ty - hy
        const len = Math.max(1, Math.hypot(dx, dy))
        S.bols.push({
          x: hx,
          y: hy,
          vx: (dx / len) * 980,
          vy: (dy / len) * 980,
          dmg: S.lv.heroDps * HERO_INT,
        })
        S.heroCd = HERO_INT
        S.heroKick = 1
        beep(880, 0.03, 'square', 0.018, -300)
      } else {
        S.heroCd = 0.08
      }
    }

    // 子弹
    for (let i = S.bols.length - 1; i >= 0; i--) {
      const b = S.bols[i]
      if (!b) continue
      b.x += b.vx * dt
      b.y += b.vy * dt
      let hit = false

      if (S.boss.engaged && S.boss.hp > 0) {
        const d = Math.hypot(b.x - CENTER, b.y - (S.boss.hitY - 40))
        if (d < 92) {
          S.boss.hp = Math.max(0, S.boss.hp - b.dmg)
          S.boss.flash = 1
          hit = true
          burst(b.x, b.y, 3, C.fire, 70, 0.3, 3)
          if (S.boss.hp <= 0) {
            S.bols.splice(i, 1)
            burst(CENTER, S.boss.hitY - 40, 70, '#ffd24a', 300, 1.2, 9)
            finish('win')
            return
          }
        }
      }

      if (!hit) {
        for (let j = S.zeds.length - 1; j >= 0; j--) {
          const z = S.zeds[j]
          if (!z) continue
          const r = ZED[z.kind].r
          if (Math.abs(z.x - b.x) < r + 6 && Math.abs(z.y - b.y) < r + 10) {
            z.hp -= b.dmg
            z.flash = 1
            hit = true
            burst(b.x, b.y, 4, '#ffd9a0', 90, 0.28, 3)
            if (z.hp <= 0) {
              S.zeds.splice(j, 1)
              S.kills++
              beep(240, 0.04, 'square', 0.02, -80)
            }
            break
          }
        }
      }

      if (hit || b.y > S.squadY + 1500) S.bols.splice(i, 1)
    }

    // Boss 吃兵
    if (S.boss.engaged && S.boss.hp > 0) {
      S.eatAcc += S.boss.eat * dt
      const whole = Math.floor(S.eatAcc)
      if (whole > 0) {
        S.eatAcc -= whole
        S.troops = Math.max(0, S.troops - whole)
        S.shake = Math.min(10, S.shake + 1.4)
        burst(S.squadX + rand(-70, 70), S.squadY + rand(0, 40), 3, '#7fbf5a', 90, 0.35, 3)
        if (S.troops <= 0) {
          finish('lose')
          return
        }
      }
    }

    stepParticles(dt)
  }

  function stepParticles(dt: number) {
    for (let i = S.parts.length - 1; i >= 0; i--) {
      const p = S.parts[i]
      if (!p) continue
      p.life -= dt
      if (p.life <= 0) {
        S.parts.splice(i, 1)
        continue
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vx *= 0.94
      p.vy *= 0.94
    }
    for (let i = S.flos.length - 1; i >= 0; i--) {
      const f = S.flos[i]
      if (!f) continue
      f.life -= dt
      if (f.life <= 0) S.flos.splice(i, 1)
    }
  }

  /* ============================================================
     10. 渲染
     ============================================================ */
  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)

    ctx.save()
    if (S.shake > 0.2) ctx.translate(rand(-S.shake, S.shake) * 0.4, rand(-S.shake, S.shake) * 0.4)

    drawRoad()
    drawGates()
    drawBoss()
    drawZeds()
    drawSquad()
    drawHero()
    drawBolts()
    drawParts()
    drawFloats()
    ctx.restore()

    drawHud()
    if (S.over) drawOverlay()
  }

  function drawRoad() {
    const off = ((camY % H) + H) % H
    ctx.drawImage(ROAD_TILE, 0, off - H)
    ctx.drawImage(ROAD_TILE, 0, off)

    // 关卡尽头：一堵墙
    const wallY = screenY(S.lv.length + 40)
    if (wallY > -200) {
      const g = ctx.createLinearGradient(0, wallY, 0, wallY + 260)
      g.addColorStop(0, '#0b1119')
      g.addColorStop(1, 'rgba(11,17,25,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, wallY - 40, W, 300)

      ctx.fillStyle = C.wall
      ctx.fillRect(ROAD_L - 30, wallY - 26, ROAD_R - ROAD_L + 60, 26)
      ctx.fillStyle = C.wallHi
      ctx.fillRect(ROAD_L - 30, wallY - 26, ROAD_R - ROAD_L + 60, 5)
      for (let x = ROAD_L - 20; x < ROAD_R + 20; x += 46) {
        ctx.fillStyle = 'rgba(0,0,0,.35)'
        ctx.fillRect(x, wallY - 20, 3, 20)
      }

      // 墙外：黑掉的城区 + 废墟剪影，别让路面无限延伸出去
      if (wallY > 26) {
        ctx.fillStyle = '#06090e'
        ctx.fillRect(0, 0, W, wallY - 26)
        ctx.fillStyle = '#0d141d'
        for (let i = 0; i < 8; i++) {
          const bw = 64 + ((i * 53) % 86)
          const bh = 70 + ((i * 71) % 150)
          const bx = ((i * 143) % (W + 120)) - 60
          ctx.fillRect(bx, wallY - 26 - bh, bw, bh)
        }
      }
    }
  }

  function laneColors(op: string) {
    if (op === 'mul') return [C.mul, C.mulDark] as const
    if (op === 'sub') return [C.sub, C.subDark] as const
    return [C.add, C.addDark] as const
  }

  function laneText(def: GateDef['lanes'][number]) {
    if (def.op === 'mul') return `×${def.value}`
    if (def.op === 'sub') return `−${def.value}`
    return `+${def.value}`
  }

  function drawGates() {
    for (let i = S.gateIdx - 1; i < Math.min(S.lv.gates.length, S.gateIdx + 4); i++) {
      if (i < 0) continue
      const g = S.lv.gates[i]
      if (!g) continue
      const sy = screenY(g.y)
      if (sy < -260 || sy > H + 260) continue

      const bandH = 96
      const top = sy - bandH / 2
      const n = g.lanes.length
      const laneW = (ROAD_R - ROAD_L) / n
      const passed = g.y < S.squadY

      ctx.save()
      ctx.globalAlpha = passed ? 0.28 : 1
      for (let k = 0; k < n; k++) {
        const def = g.lanes[k]
        if (!def) continue
        const x0 = ROAD_L + k * laneW
        const [fill, dark] = laneColors(def.op)

        const grd = ctx.createLinearGradient(x0, top, x0, top + bandH)
        grd.addColorStop(0, dark)
        grd.addColorStop(0.5, fill)
        grd.addColorStop(1, dark)
        ctx.fillStyle = grd
        ctx.globalAlpha = (passed ? 0.28 : 1) * 0.82
        ctx.fillRect(x0 + 4, top, laneW - 8, bandH)

        ctx.globalAlpha = passed ? 0.28 : 1
        ctx.fillStyle = 'rgba(255,255,255,.9)'
        ctx.fillRect(x0 + 4, top, laneW - 8, 3)
        ctx.fillRect(x0 + 4, top + bandH - 3, laneW - 8, 3)

        label(laneText(def), x0 + laneW / 2, sy + 2, 52, '#ffffff')
      }
      ctx.restore()

      // 分隔线
      if (n > 1) {
        ctx.fillStyle = 'rgba(10,14,20,.85)'
        ctx.fillRect(CENTER - 3, top - 6, 6, bandH + 12)
      }
    }
  }

  function drawZeds() {
    for (const z of S.zeds) {
      const sy = screenY(z.y)
      if (sy < -80 || sy > H + 80) continue
      const base = ZED[z.kind]
      const r = base.r
      const x = screenX(z.x)

      ctx.fillStyle = 'rgba(0,0,0,.28)'
      ctx.beginPath()
      ctx.ellipse(x, sy + r * 0.9, r * 0.9, r * 0.36, 0, 0, Math.PI * 2)
      ctx.fill()

      // 深色包边：丧尸在灰蓝路面上要跳出来
      if (z.flash <= 0.4) {
        ctx.fillStyle = 'rgba(6,10,8,.55)'
        rr(ctx, x - r * 0.78, sy - r * 0.56, r * 1.56, r * 1.62, r * 0.46)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(x, sy - r * 0.74, r * 0.7, 0, Math.PI * 2)
        ctx.fill()
      }

      // 身体
      ctx.fillStyle = z.flash > 0.4 ? '#ffffff' : base.body
      rr(ctx, x - r * 0.72, sy - r * 0.5, r * 1.44, r * 1.5, r * 0.42)
      ctx.fill()

      // 手臂
      ctx.fillStyle = z.flash > 0.4 ? '#ffffff' : base.skin
      ctx.beginPath()
      ctx.arc(x - r * 0.95, sy + r * 0.1, r * 0.3, 0, Math.PI * 2)
      ctx.arc(x + r * 0.95, sy + r * 0.1, r * 0.3, 0, Math.PI * 2)
      ctx.fill()

      // 头
      ctx.fillStyle = z.flash > 0.4 ? '#ffffff' : base.skin
      ctx.beginPath()
      ctx.arc(x, sy - r * 0.74, r * 0.62, 0, Math.PI * 2)
      ctx.fill()

      // 眼睛
      ctx.fillStyle = '#2a1410'
      ctx.beginPath()
      ctx.arc(x - r * 0.22, sy - r * 0.8, r * 0.11, 0, Math.PI * 2)
      ctx.arc(x + r * 0.22, sy - r * 0.8, r * 0.11, 0, Math.PI * 2)
      ctx.fill()

      // 血条
      if (z.hp < z.max) {
        const w = r * 2
        ctx.fillStyle = 'rgba(0,0,0,.5)'
        ctx.fillRect(x - w / 2, sy - r * 1.7, w, 4)
        ctx.fillStyle = '#8fe06a'
        ctx.fillRect(x - w / 2, sy - r * 1.7, (w * z.hp) / z.max, 4)
      }
    }
  }

  function drawSquad() {
    const n = Math.min(Math.floor(S.troops), MAX_BODY)
    if (n <= 0) return
    const cols = colsFor(n)
    const rows = Math.ceil(n / cols)
    const t = S.time

    for (let row = rows - 1; row >= 0; row--) {
      for (let col = 0; col < cols; col++) {
        const idx = row * cols + col
        if (idx >= n) continue
        const wx = S.squadX + (col - (cols - 1) / 2) * SP_X + Math.sin(t * 6 + idx * 0.9) * 1.4
        const wy = S.squadY - row * SP_Y + Math.sin(t * 9 + idx * 0.7) * 2
        const sy = screenY(wy)
        if (sy < -40 || sy > H + 40) continue
        ctx.drawImage(SOLDIER, Math.round(wx - 10.5), Math.round(sy - 22), 21, 27)
      }
    }
  }

  function colsFor(n: number) {
    if (n <= 12) return 3
    if (n <= 30) return 5
    if (n <= 70) return 8
    if (n <= 140) return 11
    if (n <= 220) return 15
    if (n <= 300) return 18
    return 21
  }

  function drawHero() {
    const x = S.squadX + 4
    const sy = screenY(S.squadY + 34)

    // 光环
    const glow = ctx.createRadialGradient(x, sy, 4, x, sy, 46)
    glow.addColorStop(0, 'rgba(99,182,255,.45)')
    glow.addColorStop(1, 'rgba(99,182,255,0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(x, sy, 46, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = 'rgba(0,0,0,.35)'
    ctx.beginPath()
    ctx.ellipse(x, sy + 24, 13, 5, 0, 0, Math.PI * 2)
    ctx.fill()

    // 身体
    ctx.fillStyle = '#2f6fd0'
    rr(ctx, x - 11, sy - 6, 22, 28, 7)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,.4)'
    rr(ctx, x - 8, sy - 3, 6, 16, 3)
    ctx.fill()

    // 头
    ctx.fillStyle = '#f2dcba'
    ctx.beginPath()
    ctx.arc(x, sy - 14, 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#1d4f8f'
    ctx.beginPath()
    ctx.arc(x, sy - 16, 9.6, Math.PI, 0)
    ctx.fill()

    // 枪
    const kick = S.heroKick * 4
    ctx.fillStyle = '#39424f'
    rr(ctx, x - 4, sy - 34 - kick, 8, 26, 3)
    ctx.fill()
    ctx.fillStyle = '#8d99a8'
    ctx.fillRect(x - 2, sy - 36 - kick, 4, 8)

    if (S.heroKick > 0.55) {
      ctx.fillStyle = `rgba(255,210,74,${(S.heroKick - 0.55) * 1.6})`
      ctx.beginPath()
      ctx.arc(x, sy - 40 - kick, 9, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  function drawBolts() {
    ctx.fillStyle = C.fire
    for (const b of S.bols) {
      const sy = screenY(b.y)
      if (sy < -30 || sy > H + 30) continue
      ctx.fillRect(b.x - 2, sy - 12, 4, 14)
      ctx.fillStyle = 'rgba(255,210,74,.35)'
      ctx.fillRect(b.x - 3, sy - 2, 6, 10)
      ctx.fillStyle = C.fire
    }
  }

  function drawParts() {
    for (const p of S.parts) {
      const a = Math.max(0, p.life / p.max)
      const sy = screenY(p.y)
      ctx.globalAlpha = a
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, sy, p.r * a, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  function drawFloats() {
    for (const f of S.flos) {
      const a = Math.max(0, f.life / f.max)
      const sy = screenY(f.y) - (1 - a) * 70
      ctx.globalAlpha = a
      ctx.font = `900 ${f.size}px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineWidth = 8
      ctx.strokeStyle = 'rgba(0,0,0,.65)'
      ctx.strokeText(f.str, f.x, sy)
      ctx.fillStyle = f.color
      ctx.fillText(f.str, f.x, sy)
    }
    ctx.globalAlpha = 1
  }

  function drawHud() {
    // 顶部条：压到接近不透明，免得远处的门/丧尸从标题里透出来
    const g = ctx.createLinearGradient(0, 0, 0, 132)
    g.addColorStop(0, 'rgba(8,12,18,.96)')
    g.addColorStop(0.72, 'rgba(8,12,18,.9)')
    g.addColorStop(1, 'rgba(8,12,18,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, 132)

    label(`第 ${S.lv.id} 关 · ${S.lv.name}`, 30, 48, 26, C.white, 'left', 700)

    const troops = Math.ceil(S.troops)
    label(`${troops}`, W - 30, 48, 44, troops <= 20 ? '#ff7a5c' : C.white, 'right', 900)
    label('兵力', W - 30 - ctx.measureText(`${troops}`).width - 16, 54, 20, C.dim, 'right', 600)

    // Boss 血条
    if (S.boss.engaged) {
      const bw = W - 120
      const bx = 60
      const by = 92
      ctx.fillStyle = 'rgba(0,0,0,.55)'
      rr(ctx, bx - 3, by - 3, bw + 6, 20, 10)
      ctx.fill()
      ctx.fillStyle = S.boss.big ? '#d9483b' : '#b8563c'
      rr(ctx, bx, by, Math.max(0, (bw * S.boss.hp) / S.boss.max), 14, 7)
      ctx.fill()
      label('BOSS', bx - 12, by + 7, 16, C.dim, 'right', 700)
    }

    // 受击红边
    if (S.hurt > 0.02) {
      const rg = ctx.createRadialGradient(W / 2, H / 2, H * 0.22, W / 2, H / 2, H * 0.62)
      rg.addColorStop(0, 'rgba(255,0,0,0)')
      rg.addColorStop(1, `rgba(255,40,20,${Math.min(0.2, S.hurt * 0.26)})`)
      ctx.fillStyle = rg
      ctx.fillRect(0, 0, W, H)
    }
  }

  function drawBoss() {
    if (S.boss.hp <= 0) return
    // 只有走进视野才画：不依赖 engaged，免得 Boss 凭空出现
    const sy = screenY(S.boss.hitY)
    if (sy < -300) return
    const x = CENTER
    const s = S.boss.big ? 1.35 : 1.1
    const pulse = 1 + Math.sin(S.boss.ph * 3) * 0.02

    ctx.save()

    const aura = ctx.createRadialGradient(x, sy - 40, 20, x, sy - 40, 190 * s)
    aura.addColorStop(0, 'rgba(217,72,59,.35)')
    aura.addColorStop(1, 'rgba(217,72,59,0)')
    ctx.fillStyle = aura
    ctx.beginPath()
    ctx.arc(x, sy - 40, 190 * s, 0, Math.PI * 2)
    ctx.fill()

    ctx.translate(x, sy)
    ctx.scale(s * pulse, s * pulse)

    // 腿
    ctx.fillStyle = '#3a4048'
    rr(ctx, -42, 6, 30, 56, 10)
    ctx.fill()
    rr(ctx, 12, 6, 30, 56, 10)
    ctx.fill()

    // 躯干
    ctx.fillStyle = S.boss.flash > 0.5 ? '#d9694a' : '#8e2f24'
    rr(ctx, -56, -78, 112, 100, 26)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,.4)'
    ctx.lineWidth = 3
    rr(ctx, -56, -78, 112, 100, 26)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,.1)'
    rr(ctx, -48, -72, 96, 24, 12)
    ctx.fill()

    // 肩甲
    ctx.fillStyle = '#5a1d14'
    rr(ctx, -70, -74, 30, 44, 12)
    ctx.fill()
    rr(ctx, 40, -74, 30, 44, 12)
    ctx.fill()

    // 胸口核心
    ctx.fillStyle = '#ff7a52'
    ctx.beginPath()
    ctx.arc(0, -30, 16 + Math.sin(S.boss.ph * 6) * 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffd8a8'
    ctx.beginPath()
    ctx.arc(0, -30, 7, 0, Math.PI * 2)
    ctx.fill()

    // 手臂 + 爪
    ctx.fillStyle = '#6d2419'
    rr(ctx, -90, -70, 36, 80, 14)
    ctx.fill()
    rr(ctx, 54, -70, 36, 80, 14)
    ctx.fill()
    ctx.fillStyle = '#c9c2b4'
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.moveTo(-84 + i * 11, 8)
      ctx.lineTo(-78 + i * 11, 32)
      ctx.lineTo(-72 + i * 11, 8)
      ctx.closePath()
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(60 + i * 11, 8)
      ctx.lineTo(66 + i * 11, 32)
      ctx.lineTo(72 + i * 11, 8)
      ctx.closePath()
      ctx.fill()
    }

    // 头
    ctx.fillStyle = S.boss.flash > 0.5 ? '#c26a4a' : '#5a1d14'
    rr(ctx, -34, -128, 68, 56, 18)
    ctx.fill()
    ctx.fillStyle = '#ff5a3c'
    ctx.beginPath()
    ctx.arc(-14, -104, 7, 0, Math.PI * 2)
    ctx.arc(14, -104, 7, 0, Math.PI * 2)
    ctx.fill()

    // 牙口
    ctx.fillStyle = '#3a0f0a'
    rr(ctx, -24, -88, 48, 12, 4)
    ctx.fill()
    ctx.fillStyle = '#e8dcc8'
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(-21 + i * 9, -88, 4, 12)
    }

    ctx.restore()
  }

  function drawOverlay() {
    ctx.fillStyle = 'rgba(6,9,14,.72)'
    ctx.fillRect(0, 0, W, H)

    const win = S.over === 'win'
    const cy = H * 0.42
    label(win ? '通关！' : '兵力耗尽', W / 2, cy - 90, 84, win ? '#ffd24a' : '#ff7a5c')
    label(S.lv.name, W / 2, cy + 4, 30, C.dim)

    if (win) {
      const next = S.lv.id < MAX_LEVEL ? `第 ${S.lv.id + 1} 关` : ''
      label(next ? `点击进入 ${next}` : '全部通关，了不起', W / 2, cy + 90, 30, C.white, 'center', 700)
    } else {
      label(`点击重来 · 剩 ${Math.max(0, Math.ceil(S.troops))} 兵`, W / 2, cy + 90, 28, C.white, 'center', 700)
    }

    label('← → 或左右滑动控制队伍', W / 2, H - 90, 20, 'rgba(244,247,251,.4)')
  }

  /* ============================================================
     11. 主循环
     ============================================================ */
  let last = performance.now()
  let raf = 0
  let running = false

  function loop(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    update(dt)
    camY = Math.max(0, S.squadY - CAM_LAG)
    render()
    emitState()
    raf = requestAnimationFrame(loop)
  }

  let lastEmit = 0
  function snapshot(): HordeState {
    return {
      level: S.lv.id,
      levelName: S.lv.name,
      troops: Math.ceil(S.troops),
      bossHp: Math.round(S.boss.hp),
      bossMax: S.boss.max,
      heroDps: S.lv.heroDps,
      progress: clamp(S.squadY / S.lv.length, 0, 1),
      lane: S.squadX < CENTER ? 0 : 1,
      over: S.over,
      muted: S.muted,
    }
  }

  function emitState() {
    const cb = options.onState
    if (!cb) return
    const now = performance.now()
    if (now - lastEmit < 100 && !S.over) return
    lastEmit = now
    cb(snapshot())
  }

  function start() {
    if (running) return
    running = true
    last = performance.now()
    raf = requestAnimationFrame(loop)
  }

  function stop() {
    if (!running) return
    running = false
    cancelAnimationFrame(raf)
  }

  function restart(levelId?: number) {
    S = freshRun(levelId ?? S.lv.id)
    camY = Math.max(0, S.squadY - CAM_LAG)
    last = performance.now()
    emitState()
  }

  function tapOverlay() {
    if (S.over === 'win' && S.lv.id < MAX_LEVEL) restart(S.lv.id + 1)
    else restart(S.lv.id)
  }

  function destroy() {
    stop()
    abort.abort()
    window.removeEventListener('resize', onResize)
    if (actx && actx.state !== 'closed') {
      void actx.close()
      actx = null
    }
  }

  camY = Math.max(0, S.squadY - CAM_LAG)

  return {
    start,
    destroy,
    restart,
    toggleMute: () => {
      S.muted = !S.muted
      if (!S.muted) beep(660, 0.08, 'sine', 0.05, 120)
      emitState()
    },
    getState: snapshot,
  }
}

export { LEVELS, MAX_LEVEL }
export type { LevelDef }
