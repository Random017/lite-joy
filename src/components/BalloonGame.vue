<script setup lang="ts">
import { ref, onUnmounted } from 'vue'

const emit = defineEmits<{
  back: []
}>()

interface Balloon {
  id: number
  x: number
  y: number
  vx: number
  color: string
  size: number
  speed: number
  popping: boolean
  wobbleOffset: number
}

interface Particle {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  color: string
  size: number
  life: number
}

const BALLOON_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA',
  '#FF8A65', '#4DD0E1', '#AED581', '#FFD54F',
  '#CE93D8', '#4FC3F7', '#FFB74D', '#81C784',
  '#F06292', '#7986CB', '#4DB6AC', '#A1887F',
]

const score = ref(0)
const timeLeft = ref(60)
const gameOver = ref(false)
const gameStarted = ref(false)
const balloons = ref<Balloon[]>([])
const particles = ref<Particle[]>([])
const poppedCount = ref(0)

let balloonId = 0
let particleId = 0
let countdownTimer: ReturnType<typeof setInterval> | null = null
let spawnTimer: ReturnType<typeof setInterval> | null = null
let animFrame = 0
let lastTime = 0
let audioCtx: AudioContext | null = null

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min
}

function playPopSound() {
  if (!audioCtx) audioCtx = new AudioContext()
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.connect(gain)
  gain.connect(audioCtx.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(600, audioCtx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.15)
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15)
  osc.start(audioCtx.currentTime)
  osc.stop(audioCtx.currentTime + 0.15)
}

function spawnBalloon() {
  const color = BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)]
  const size = randomBetween(40, 90)
  balloons.value.push({
    id: balloonId++,
    x: randomBetween(5, 85),
    y: randomBetween(-5, 5),
    vx: randomBetween(-0.3, 0.3),
    color,
    size,
    speed: randomBetween(0.08, 0.18),
    popping: false,
    wobbleOffset: randomBetween(0, Math.PI * 2),
  })
}

function spawnParticles(x: number, y: number, color: string) {
  // 内圈碎片 - 小而快
  for (let i = 0; i < 12; i++) {
    const angle = (Math.PI * 2 / 12) * i + randomBetween(-0.4, 0.4)
    const speed = randomBetween(4, 8)
    particles.value.push({
      id: particleId++,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      color,
      size: randomBetween(5, 10),
      life: 1,
    })
  }
  // 外圈碎片 - 大而慢，颜色随机
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 / 8) * i + randomBetween(-0.5, 0.5)
    const speed = randomBetween(2, 4)
    particles.value.push({
      id: particleId++,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1,
      color: BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)],
      size: randomBetween(8, 16),
      life: 1,
    })
  }
  // 中心闪光碎片
  for (let i = 0; i < 6; i++) {
    const angle = randomBetween(0, Math.PI * 2)
    const speed = randomBetween(1, 3)
    particles.value.push({
      id: particleId++,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: '#FFFFFF',
      size: randomBetween(3, 6),
      life: 1,
    })
  }
}

function popBalloon(balloon: Balloon, event: MouseEvent) {
  if (balloon.popping) return
  balloon.popping = true
  score.value += 10
  poppedCount.value++
  playPopSound()
  spawnParticles(balloon.x, 100 - balloon.y, balloon.color)
  setTimeout(() => {
    balloons.value = balloons.value.filter(b => b.id !== balloon.id)
  }, 100)
}

function gameLoop(timestamp: number) {
  if (!gameStarted.value) return
  const delta = Math.min((timestamp - lastTime) / 16.67, 3)
  lastTime = timestamp

  // 更新气球位置
  for (const b of balloons.value) {
    if (b.popping) continue
    b.y += b.speed * delta
    const wobble = Math.sin(timestamp * 0.002 + b.wobbleOffset) * 0.2
    b.x += (b.vx + wobble) * delta * 0.5
    // 边界反弹
    if (b.x < 0 || b.x > 95) b.vx *= -1
  }

  // 移除飞出屏幕的气球
  balloons.value = balloons.value.filter(b => b.y < 120 || b.popping)

  // 更新粒子
  for (const p of particles.value) {
    p.x += p.vx * delta
    p.y += p.vy * delta
    p.vy += 0.08 * delta
    p.life -= 0.018 * delta
  }
  particles.value = particles.value.filter(p => p.life > 0)

  animFrame = requestAnimationFrame(gameLoop)
}

function startGame() {
  score.value = 0
  timeLeft.value = 60
  gameOver.value = false
  gameStarted.value = true
  poppedCount.value = 0
  balloons.value = []
  particles.value = []
  balloonId = 0
  particleId = 0
  lastTime = performance.now()

  spawnTimer = setInterval(spawnBalloon, 500)

  countdownTimer = setInterval(() => {
    timeLeft.value--
    if (timeLeft.value <= 0) {
      endGame()
    }
  }, 1000)

  animFrame = requestAnimationFrame(gameLoop)
}

function endGame() {
  gameOver.value = true
  gameStarted.value = false
  if (countdownTimer) clearInterval(countdownTimer)
  if (spawnTimer) clearInterval(spawnTimer)
  if (animFrame) cancelAnimationFrame(animFrame)
  countdownTimer = null
  spawnTimer = null
  animFrame = 0
}

onUnmounted(() => {
  if (countdownTimer) clearInterval(countdownTimer)
  if (spawnTimer) clearInterval(spawnTimer)
  if (animFrame) cancelAnimationFrame(animFrame)
})
</script>

<template>
  <div class="game-container">
    <div class="game-header">
      <button class="back-btn" @click="emit('back')">← 返回</button>
      <div class="score-display">
        <span>得分: {{ score }}</span>
        <span class="timer">时间: {{ timeLeft }}s</span>
      </div>
    </div>

    <div v-if="!gameStarted && !gameOver" class="start-screen">
      <div class="start-emoji">🎈</div>
      <h2>气球爆炸</h2>
      <p>点击气球获得分数，60秒内尽量多点击！</p>
      <button class="start-btn" @click="startGame">开始游戏</button>
    </div>

    <div v-if="gameOver" class="game-over-screen">
      <div class="game-over-emoji">🎉</div>
      <h2>游戏结束！</h2>
      <p class="final-score">最终得分: {{ score }}</p>
      <p>击破气球: {{ poppedCount }} 个</p>
      <button class="start-btn" @click="startGame">再来一局</button>
      <button class="back-link" @click="emit('back')">返回首页</button>
    </div>

    <div v-if="gameStarted" class="game-area">
      <div
        v-for="b in balloons"
        :key="b.id"
        class="balloon"
        :class="{ popping: b.popping }"
        :style="{
          transform: `translate3d(${b.x}vw, ${b.y}vh, 0)`,
          width: b.size + 'px',
          height: b.size * 1.25 + 'px',
          backgroundColor: b.color,
        }"
        @click="popBalloon(b, $event)"
      >
        <div class="balloon-knot" :style="{ borderTopColor: b.color }"></div>
      </div>

      <div
        v-for="p in particles"
        :key="p.id"
        class="particle"
        :style="{
          transform: `translate3d(${p.x}vw, ${p.y}vh, 0)`,
          width: p.size + 'px',
          height: p.size + 'px',
          backgroundColor: p.color,
          opacity: p.life,
        }"
      ></div>
    </div>
  </div>
</template>

<style scoped>
.game-container {
  width: 100%;
  height: 100vh;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  position: relative;
  overflow: hidden;
  user-select: none;
}

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  position: relative;
  z-index: 10;
}

.back-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.score-display {
  color: white;
  font-size: 18px;
  font-weight: bold;
  display: flex;
  gap: 24px;
}

.timer {
  color: #FF6B6B;
}

.start-screen,
.game-over-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: calc(100vh - 80px);
  color: white;
  text-align: center;
}

.start-emoji {
  font-size: 96px;
  animation: float 2s ease-in-out infinite;
}

.game-over-emoji {
  font-size: 96px;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-20px); }
}

.start-screen h2,
.game-over-screen h2 {
  font-size: 36px;
  margin: 16px 0;
}

.start-screen p,
.game-over-screen p {
  font-size: 16px;
  opacity: 0.8;
  margin-bottom: 24px;
}

.final-score {
  font-size: 28px !important;
  color: #FFEAA7;
}

.start-btn {
  background: linear-gradient(135deg, #FF6B6B, #ee5a24);
  border: none;
  color: white;
  padding: 14px 40px;
  border-radius: 30px;
  font-size: 18px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.start-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 8px 20px rgba(255, 107, 107, 0.4);
}

.back-link {
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.4);
  color: white;
  padding: 10px 24px;
  border-radius: 20px;
  font-size: 14px;
  cursor: pointer;
  margin-top: 12px;
  transition: background 0.2s;
}

.back-link:hover {
  background: rgba(255, 255, 255, 0.1);
}

.game-area {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.balloon {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: 50% 50% 50% 50% / 40% 40% 60% 60%;
  cursor: pointer;
  pointer-events: auto;
  will-change: transform;
  box-shadow: inset -8px -8px 20px rgba(0, 0, 0, 0.15),
              inset 8px 8px 20px rgba(255, 255, 255, 0.2);
}

.balloon::before {
  content: '';
  position: absolute;
  top: 15%;
  left: 20%;
  width: 25%;
  height: 25%;
  background: rgba(255, 255, 255, 0.35);
  border-radius: 50%;
  transform: rotate(-30deg);
}

.balloon:hover {
  filter: brightness(1.15);
}

.balloon.popping {
  animation: pop 0.2s ease-out forwards;
  pointer-events: none;
}

.balloon-knot {
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
}

.particle {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: 50%;
  pointer-events: none;
  will-change: transform, opacity;
  box-shadow: 0 0 6px 2px currentColor;
}

@keyframes pop {
  0% {
    transform: translate3d(var(--tx, 0), var(--ty, 0), 0) scale(1);
    opacity: 1;
    filter: brightness(1);
  }
  20% {
    transform: translate3d(var(--tx, 0), var(--ty, 0), 0) scale(1.6);
    opacity: 1;
    filter: brightness(2);
  }
  100% {
    transform: translate3d(var(--tx, 0), var(--ty, 0), 0) scale(0);
    opacity: 0;
    filter: brightness(3);
  }
}
</style>
