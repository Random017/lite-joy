<script setup lang="ts">
import { ref, onUnmounted, nextTick, computed, onMounted } from 'vue'

const emit = defineEmits<{
  back: []
}>()

// ==================== 游戏配置变量 ====================
const CONFIG = {
  // 画布尺寸（会被响应式调整）
  CANVAS_WIDTH: 400,
  CANVAS_HEIGHT: 600,

  // 砖块配置
  BRICK_SIZE: 40,           // 正方形边长 / 三角形底边
  BRICK_GAP: 8,             // 砖块间隙
  BRICK_TOP_OFFSET: 60,     // 砖块区域顶部偏移
  BRICK_LEFT_OFFSET: 20,    // 砖块区域左侧偏移
  BRICK_COLS: 9,            // 列数
  BRICK_ROWS: 8,            // 行数
  BRICK_VALUE_MIN: 1,       // 砖块最小数值
  BRICK_VALUE_MAX: 5,       // 砖块最大数值
  TRIANGLE_RATIO: 0.3,      // 三角形砖块比例

  // 球配置
  BALL_RADIUS: 6,
  BALL_SPEED: 5,
  BALL_LAUNCH_INTERVAL: 100, // 发球间隔(ms)
  INITIAL_BALLS: 10,

  // 发射器配置
  LAUNCHER_Y_OFFSET: 40,    // 发射点距底部偏移
  AIM_LINE_LENGTH: 150,     // 瞄准线长度
  AIM_DASH_GAP: 8,          // 虚线间隔

  // 关卡配置
  LEVEL_VALUE_INCREASE: 1,  // 每关数值增加

  // 速度倍率
  SPEED_MIN: 1,
  SPEED_MAX: 4,
  SPEED_INCREASE_INTERVAL: 30000, // 每30秒加速
}

// ==================== 类型定义 ====================
type BrickShape = 'square' | 'triangle'
type TriangleDir = 'up' | 'down' | 'left' | 'right'

interface Brick {
  id: number
  x: number
  y: number
  shape: BrickShape
  triangleDir?: TriangleDir
  value: number
  hasBall: boolean      // 砖块内是否有球
}

interface Ball {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  active: boolean       // 是否在运动
}

// ==================== 游戏状态 ====================
const gameStarted = ref(false)
const score = ref(0)
const level = ref(1)
const totalBalls = ref(CONFIG.INITIAL_BALLS)
const remainingBalls = ref(0)     // 待发射的球数
const activeBalls = ref<Ball[]>([])
const bricks = ref<Brick[]>([])
const gameOver = ref(false)
const gameWon = ref(false)
const isLaunching = ref(false)    // 是否正在发球
const canLaunch = ref(true)       // 是否可以发球
const launchAngle = ref(-Math.PI / 2) // 发射角度（向上）
const launcherX = ref(0)          // 发射点X（动态计算）
const collectedBalls = ref(0)     // 本回合收集的球数
const firstLandingX = ref<number | null>(null) // 第一个球落点

const gameSpeed = ref(1)
const hasLaunched = ref(false)  // 是否已经发射过球（用于判断回合结束）
let speedTimer: ReturnType<typeof setInterval> | null = null

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let animFrame = 0
let brickId = 0
let ballId = 0
let launchTimer: ReturnType<typeof setInterval> | null = null

// 响应式画布尺寸
const canvasWidth = ref(CONFIG.CANVAS_WIDTH)
const canvasHeight = ref(CONFIG.CANVAS_HEIGHT)
const scale = ref(1)

// ==================== 辅助函数 ====================
function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// 计算响应式尺寸
function updateCanvasSize() {
  const container = containerRef.value
  if (!container) return

  const maxWidth = Math.min(container.clientWidth - 20, CONFIG.CANVAS_WIDTH)
  scale.value = maxWidth / CONFIG.CANVAS_WIDTH
  canvasWidth.value = maxWidth
  canvasHeight.value = maxWidth * (CONFIG.CANVAS_HEIGHT / CONFIG.CANVAS_WIDTH)
}

// 根据缩放调整坐标
function scaleValue(value: number): number {
  return value * scale.value
}

// 获取发射点Y坐标
function getLauncherY(): number {
  return canvasHeight.value - scaleValue(CONFIG.LAUNCHER_Y_OFFSET)
}

// ==================== 音效 ====================
let audioCtx: AudioContext | null = null

function playLaunchSound() {
  if (!audioCtx) audioCtx = new AudioContext()
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.connect(gain)
  gain.connect(audioCtx.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(800, audioCtx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.1)
  gain.gain.setValueAtTime(0.15, audioCtx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1)
  osc.start(audioCtx.currentTime)
  osc.stop(audioCtx.currentTime + 0.1)
}

function playHitSound() {
  if (!audioCtx) audioCtx = new AudioContext()
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.connect(gain)
  gain.connect(audioCtx.destination)
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(300, audioCtx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.08)
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08)
  osc.start(audioCtx.currentTime)
  osc.stop(audioCtx.currentTime + 0.08)
}

// ==================== 关卡生成 ====================
function generateLevel() {
  bricks.value = []
  brickId = 0

  const baseValue = CONFIG.BRICK_VALUE_MIN + (level.value - 1) * CONFIG.LEVEL_VALUE_INCREASE
  const maxValue = Math.min(CONFIG.BRICK_VALUE_MAX + (level.value - 1), 15)

  const brickSize = scaleValue(CONFIG.BRICK_SIZE)
  const brickGap = scaleValue(CONFIG.BRICK_GAP)
  const leftOffset = scaleValue(CONFIG.BRICK_LEFT_OFFSET)
  const topOffset = scaleValue(CONFIG.BRICK_TOP_OFFSET)

  for (let row = 0; row < CONFIG.BRICK_ROWS; row++) {
    for (let col = 0; col < CONFIG.BRICK_COLS; col++) {
      // 随机跳过一些位置，制造间隙
      if (Math.random() < 0.25) continue

      const x = leftOffset + col * (brickSize + brickGap)
      const y = topOffset + row * (brickSize + brickGap)

      const isTriangle = Math.random() < CONFIG.TRIANGLE_RATIO
      const triangleDirs: TriangleDir[] = ['up', 'down', 'left', 'right']

      bricks.value.push({
        id: brickId++,
        x,
        y,
        shape: isTriangle ? 'triangle' : 'square',
        triangleDir: isTriangle ? triangleDirs[randomInt(0, 3)] : undefined,
        value: randomInt(baseValue, maxValue),
        hasBall: Math.random() < 0.1, // 10%概率有球
      })
    }
  }
}

// ==================== 发球相关 ====================
function launchBall() {
  if (remainingBalls.value <= 0) {
    stopLaunching()
    return
  }

  playLaunchSound()
  const speed = scaleValue(CONFIG.BALL_SPEED) * gameSpeed.value
  activeBalls.value.push({
    id: ballId++,
    x: launcherX.value,
    y: getLauncherY(),
    vx: Math.cos(launchAngle.value) * speed,
    vy: Math.sin(launchAngle.value) * speed,
    active: true,
  })
  remainingBalls.value--
}

function startLaunching() {
  if (!canLaunch.value || isLaunching.value) return
  isLaunching.value = true
  canLaunch.value = false
  hasLaunched.value = true
  remainingBalls.value = totalBalls.value
  collectedBalls.value = 0
  firstLandingX.value = null

  // 立即发射第一个球
  launchBall()
  // 后续球间隔发射
  launchTimer = setInterval(launchBall, CONFIG.BALL_LAUNCH_INTERVAL / gameSpeed.value)
}

function stopLaunching() {
  if (launchTimer) {
    clearInterval(launchTimer)
    launchTimer = null
  }
  isLaunching.value = false
}

// ==================== 碰撞检测 ====================
function checkBrickCollision(ball: Ball, brick: Brick): { hit: boolean; newVx: number; newVy: number } {
  const r = scaleValue(CONFIG.BALL_RADIUS)
  const size = scaleValue(CONFIG.BRICK_SIZE)

  if (brick.shape === 'square') {
    // 正方形碰撞
    const closestX = Math.max(brick.x, Math.min(ball.x, brick.x + size))
    const closestY = Math.max(brick.y, Math.min(ball.y, brick.y + size))
    const dx = ball.x - closestX
    const dy = ball.y - closestY

    if (dx * dx + dy * dy < r * r) {
      // 判断碰撞面
      if (Math.abs(dx) > Math.abs(dy)) {
        return { hit: true, newVx: -ball.vx, newVy: ball.vy }
      } else {
        return { hit: true, newVx: ball.vx, newVy: -ball.vy }
      }
    }
  } else {
    // 三角形碰撞（简化：用圆形近似）
    const cx = brick.x + size / 2
    const cy = brick.y + size / 2

    const dist = Math.sqrt((ball.x - cx) ** 2 + (ball.y - cy) ** 2)
    if (dist < size / 2 + r) {
      const nx = (ball.x - cx) / dist
      const ny = (ball.y - cy) / dist
      const dot = ball.vx * nx + ball.vy * ny
      return {
        hit: true,
        newVx: ball.vx - 2 * dot * nx,
        newVy: ball.vy - 2 * dot * ny,
      }
    }
  }

  return { hit: false, newVx: ball.vx, newVy: ball.vy }
}

// ==================== 游戏循环 ====================
function gameLoop() {
  if (gameOver.value || gameWon.value) return
  update()
  draw()
  animFrame = requestAnimationFrame(gameLoop)
}

function update() {
  const canvas = canvasRef.value
  if (!canvas) return

  const w = canvasWidth.value
  const h = canvasHeight.value
  const r = scaleValue(CONFIG.BALL_RADIUS)

  for (const ball of activeBalls.value) {
    if (!ball.active) continue

    ball.x += ball.vx
    ball.y += ball.vy

    // 左右墙壁
    if (ball.x - r < 0) {
      ball.x = r
      ball.vx = Math.abs(ball.vx)
    }
    if (ball.x + r > w) {
      ball.x = w - r
      ball.vx = -Math.abs(ball.vx)
    }
    // 顶部
    if (ball.y - r < 0) {
      ball.y = r
      ball.vy = Math.abs(ball.vy)
    }

    // 砖块碰撞
    for (const brick of bricks.value) {
      const { hit, newVx, newVy } = checkBrickCollision(ball, brick)
      if (hit) {
        ball.vx = newVx
        ball.vy = newVy
        brick.value--
        score.value += 10
        playHitSound()

        if (brick.value <= 0) {
          if (brick.hasBall) {
            totalBalls.value++
          }
          bricks.value = bricks.value.filter(b => b.id !== brick.id)
        }
        break
      }
    }

    // 底部收集
    if (ball.y + r > h) {
      ball.active = false
      collectedBalls.value++

      if (firstLandingX.value === null) {
        firstLandingX.value = ball.x
        launcherX.value = Math.max(r, Math.min(w - r, ball.x))
      }
    }
  }

  // 移除不活跃的球
  activeBalls.value = activeBalls.value.filter(b => b.active)

  // 检查回合结束（必须已经发射过球）
  if (hasLaunched.value && !isLaunching.value && remainingBalls.value === 0 && activeBalls.value.length === 0) {
    endRound()
  }
}

function endRound() {
  hasLaunched.value = false

  // 先检查是否过关（消灭所有砖块）
  if (bricks.value.length === 0) {
    level.value++
    totalBalls.value++
    generateLevel()
    canLaunch.value = true
    return
  }

  // 砖块下移
  const brickSize = scaleValue(CONFIG.BRICK_SIZE)
  const brickGap = scaleValue(CONFIG.BRICK_GAP)
  for (const brick of bricks.value) {
    brick.y += brickSize + brickGap
  }

  // 检查游戏结束（砖块碰到底部）
  const bottomLine = canvasHeight.value - scaleValue(20)
  for (const brick of bricks.value) {
    if (brick.y + brickSize > bottomLine) {
      gameOver.value = true
      stopGame()
      return
    }
  }

  canLaunch.value = true
}

function stopGame() {
  if (animFrame) cancelAnimationFrame(animFrame)
  if (launchTimer) clearInterval(launchTimer)
  if (speedTimer) clearInterval(speedTimer)
}

// ==================== 绘制 ====================
function draw() {
  const canvas = canvasRef.value
  if (!canvas || !ctx) return

  const w = canvasWidth.value
  const h = canvasHeight.value

  // 背景
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, w, h)

  // 绘制砖块
  for (const brick of bricks.value) {
    drawBrick(brick)
  }

  // 绘制球
  for (const ball of activeBalls.value) {
    if (ball.active) {
      ctx.beginPath()
      ctx.arc(ball.x, ball.y, scaleValue(CONFIG.BALL_RADIUS), 0, Math.PI * 2)
      ctx.fillStyle = '#fff'
      ctx.fill()
    }
  }

  // 绘制发射点和瞄准线
  if (canLaunch.value && !isLaunching.value) {
    drawAimLine()
  }

  // 绘制发射点
  ctx.beginPath()
  ctx.arc(launcherX.value, getLauncherY(), scaleValue(8), 0, Math.PI * 2)
  ctx.fillStyle = '#667eea'
  ctx.fill()

  // 显示待发射球数
  ctx.fillStyle = '#fff'
  ctx.font = `bold ${scaleValue(14)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(`×${remainingBalls.value || totalBalls.value}`, launcherX.value, getLauncherY() + scaleValue(25))
}

function drawBrick(brick: Brick) {
  const size = scaleValue(CONFIG.BRICK_SIZE)
  ctx!.save()

  // 颜色根据数值
  const hue = (brick.value * 30) % 360
  ctx!.fillStyle = `hsl(${hue}, 70%, 50%)`
  ctx!.strokeStyle = `hsl(${hue}, 70%, 40%)`
  ctx!.lineWidth = scaleValue(2)

  if (brick.shape === 'square') {
    ctx!.beginPath()
    ctx!.roundRect(brick.x, brick.y, size, size, scaleValue(4))
    ctx!.fill()
    ctx!.stroke()
  } else {
    // 三角形
    ctx!.beginPath()
    const cx = brick.x + size / 2
    const cy = brick.y + size / 2
    const half = size / 2

    switch (brick.triangleDir) {
      case 'up':
        ctx!.moveTo(cx, cy - half)
        ctx!.lineTo(cx + half, cy + half)
        ctx!.lineTo(cx - half, cy + half)
        break
      case 'down':
        ctx!.moveTo(cx, cy + half)
        ctx!.lineTo(cx + half, cy - half)
        ctx!.lineTo(cx - half, cy - half)
        break
      case 'left':
        ctx!.moveTo(cx - half, cy)
        ctx!.lineTo(cx + half, cy + half)
        ctx!.lineTo(cx + half, cy - half)
        break
      case 'right':
        ctx!.moveTo(cx + half, cy)
        ctx!.lineTo(cx - half, cy + half)
        ctx!.lineTo(cx - half, cy - half)
        break
    }
    ctx!.closePath()
    ctx!.fill()
    ctx!.stroke()
  }

  // 数值
  ctx!.fillStyle = '#fff'
  ctx!.font = `bold ${scaleValue(12)}px sans-serif`
  ctx!.textAlign = 'center'
  ctx!.textBaseline = 'middle'
  ctx!.fillText(String(brick.value), brick.x + size / 2, brick.y + size / 2)

  // 球标记
  if (brick.hasBall) {
    ctx!.beginPath()
    ctx!.arc(brick.x + size - scaleValue(8), brick.y + scaleValue(8), scaleValue(5), 0, Math.PI * 2)
    ctx!.fillStyle = '#fff'
    ctx!.fill()
  }

  ctx!.restore()
}

function drawAimLine() {
  const startX = launcherX.value
  const startY = getLauncherY()
  const angle = launchAngle.value
  const speed = scaleValue(CONFIG.BALL_SPEED)

  // 模拟轨迹
  let x = startX
  let y = startY
  let vx = Math.cos(angle) * speed
  let vy = Math.sin(angle) * speed
  const r = scaleValue(CONFIG.BALL_RADIUS)

  ctx!.setLineDash([scaleValue(4), scaleValue(4)])
  ctx!.strokeStyle = 'rgba(255, 255, 255, 0.5)'
  ctx!.lineWidth = scaleValue(2)
  ctx!.beginPath()
  ctx!.moveTo(x, y)

  for (let i = 0; i < 100; i++) {
    x += vx
    y += vy

    if (x < r) { x = r; vx = Math.abs(vx) }
    if (x > canvasWidth.value - r) { x = canvasWidth.value - r; vx = -Math.abs(vx) }
    if (y < r) { y = r; vy = Math.abs(vy) }
    if (y > canvasHeight.value) break

    ctx!.lineTo(x, y)
  }

  ctx!.stroke()
  ctx!.setLineDash([])
}

// ==================== 交互 ====================
function getPointerPosition(e: MouseEvent | TouchEvent): { x: number; y: number } | null {
  const canvas = canvasRef.value
  if (!canvas) return null

  const rect = canvas.getBoundingClientRect()
  let clientX: number, clientY: number

  if (e instanceof MouseEvent) {
    clientX = e.clientX
    clientY = e.clientY
  } else if (e.touches.length > 0) {
    clientX = e.touches[0].clientX
    clientY = e.touches[0].clientY
  } else {
    return null
  }

  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  }
}

function handlePointerMove(e: MouseEvent | TouchEvent) {
  if (!canLaunch.value || isLaunching.value) return

  const pos = getPointerPosition(e)
  if (!pos) return

  const dx = pos.x - launcherX.value
  const dy = pos.y - getLauncherY()
  let angle = Math.atan2(dy, dx)

  // 限制角度在向上半圆
  if (angle > 0) angle = angle > Math.PI / 2 ? Math.PI - 0.1 : 0.1
  launchAngle.value = angle

  e.preventDefault()
}

function handlePointerEnd(e: MouseEvent | TouchEvent) {
  if (canLaunch.value && !isLaunching.value) {
    startLaunching()
  }
  e.preventDefault()
}

// 鼠标事件
function handleMouseMove(e: MouseEvent) {
  handlePointerMove(e)
}

function handleClick(_e: MouseEvent) {
  // 点击时不立即发射，由 touchend 处理
}

// 触摸事件
function handleTouchStart(e: TouchEvent) {
  handlePointerMove(e)
}

function handleTouchMove(e: TouchEvent) {
  handlePointerMove(e)
}

function handleTouchEnd(e: TouchEvent) {
  handlePointerEnd(e)
}

// ==================== 游戏控制 ====================
async function startGame() {
  gameStarted.value = true
  score.value = 0
  level.value = 1
  totalBalls.value = CONFIG.INITIAL_BALLS
  gameOver.value = false
  gameWon.value = false
  canLaunch.value = true
  isLaunching.value = false
  activeBalls.value = []
  collectedBalls.value = 0
  firstLandingX.value = null
  gameSpeed.value = CONFIG.SPEED_MIN
  hasLaunched.value = false

  updateCanvasSize()
  launcherX.value = canvasWidth.value / 2

  generateLevel()

  await nextTick()
  const canvas = canvasRef.value
  if (canvas) {
    ctx = canvas.getContext('2d')
  }

  // 速度递增
  speedTimer = setInterval(() => {
    if (isLaunching.value) {
      gameSpeed.value = Math.min(gameSpeed.value * 1.5, CONFIG.SPEED_MAX)
    }
  }, CONFIG.SPEED_INCREASE_INTERVAL)

  animFrame = requestAnimationFrame(gameLoop)
}

// 监听窗口大小变化
function handleResize() {
  if (gameStarted.value && !gameOver.value && !gameWon.value) {
    // 保存相对位置
    const oldWidth = canvasWidth.value
    updateCanvasSize()

    // 调整发射点位置
    launcherX.value = launcherX.value * (canvasWidth.value / oldWidth)

    // 重新生成关卡以适应新尺寸
    generateLevel()
  }
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  stopGame()
})

// ==================== 计算属性 ====================
const statusText = computed(() => {
  if (gameOver.value) return '游戏结束'
  if (gameWon.value) return '恭喜过关!'
  if (isLaunching.value) return `发射中... 剩余: ${remainingBalls.value}`
  return `准备发射 (球数: ${totalBalls.value})`
})
</script>

<template>
  <div class="game-container" ref="containerRef">
    <div class="game-header">
      <button class="back-btn" @click="emit('back')">← 返回</button>
      <div class="info-display">
        <span>关卡: {{ level }}</span>
        <span>得分: {{ score }}</span>
        <span class="speed" v-if="gameSpeed > 1">{{ gameSpeed.toFixed(1) }}x</span>
      </div>
    </div>

    <!-- 开始界面 -->
    <div v-if="!gameStarted" class="start-screen">
      <div class="start-emoji">🧱</div>
      <h2>打砖块</h2>
      <p>滑动调整角度，点击发射小球！</p>
      <p class="hint">球数会随关卡增加，砖块内也可能藏有球</p>
      <button class="start-btn" @click="startGame">开始游戏</button>
    </div>

    <!-- 游戏结束/胜利界面 -->
    <div v-if="gameStarted && (gameOver || gameWon)" class="result-screen">
      <div class="result-emoji">{{ gameWon ? '🎉' : '😢' }}</div>
      <h2>{{ gameWon ? '恭喜过关！' : '游戏结束' }}</h2>
      <p class="final-score">最终得分: {{ score }}</p>
      <p>到达关卡: {{ level }}</p>
      <button class="start-btn" @click="startGame">再来一局</button>
      <button class="back-link" @click="emit('back')">返回首页</button>
    </div>

    <!-- 游戏画布 -->
    <div v-if="gameStarted" class="game-area">
      <canvas
        ref="canvasRef"
        :width="canvasWidth"
        :height="canvasHeight"
        class="game-canvas"
        @mousemove="handleMouseMove"
        @click="handleClick"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
      ></canvas>
      <div class="status-bar">{{ statusText }}</div>
    </div>
  </div>
</template>

<style scoped>
.game-container {
  width: 100%;
  height: 100vh;
  height: 100dvh; /* 动态视口高度，适配移动端地址栏 */
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  display: flex;
  flex-direction: column;
  user-select: none;
  touch-action: none; /* 禁止默认触摸行为 */
  -webkit-touch-callout: none;
  -webkit-user-select: none;
}

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  flex-shrink: 0;
}

.back-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 8px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  -webkit-tap-highlight-color: transparent;
}

.back-btn:active {
  background: rgba(255, 255, 255, 0.2);
}

.info-display {
  color: white;
  font-size: 14px;
  font-weight: bold;
  display: flex;
  gap: 12px;
}

.speed {
  color: #FFEAA7;
}

.start-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: white;
  text-align: center;
  padding: 20px;
}

.start-emoji {
  font-size: 80px;
  animation: bounce 1s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-15px); }
}

.start-screen h2 {
  font-size: 32px;
  margin: 12px 0;
}

.start-screen p {
  font-size: 15px;
  opacity: 0.8;
  margin-bottom: 8px;
}

.start-screen .hint {
  font-size: 13px;
  opacity: 0.6;
  margin-bottom: 20px;
}

.start-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  color: white;
  padding: 14px 40px;
  border-radius: 24px;
  font-size: 17px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.start-btn:active {
  transform: scale(0.98);
}

.result-screen {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: white;
  z-index: 10;
  background: rgba(0, 0, 0, 0.8);
  padding: 32px;
  border-radius: 16px;
  max-width: 90%;
}

.result-emoji {
  font-size: 64px;
}

.result-screen h2 {
  font-size: 24px;
  margin: 10px 0;
}

.result-screen p {
  font-size: 15px;
  opacity: 0.8;
  margin-bottom: 8px;
}

.final-score {
  font-size: 22px !important;
  color: #FFEAA7;
}

.back-link {
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.4);
  color: white;
  padding: 10px 20px;
  border-radius: 16px;
  font-size: 14px;
  cursor: pointer;
  margin-top: 10px;
  -webkit-tap-highlight-color: transparent;
}

.game-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.game-canvas {
  display: block;
  border-radius: 8px;
  touch-action: none;
}

.status-bar {
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  margin-top: 8px;
  text-align: center;
}
</style>
