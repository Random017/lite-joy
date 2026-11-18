<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { createHordeGame, type HordeGameHandle } from '../games/horde/engine'
import { LEVELS, MAX_LEVEL } from '../games/horde/levels'

const emit = defineEmits<{
  back: []
}>()

const STORE_KEY = 'lite-joy.horde.unlocked'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const playing = ref(false)
const unlocked = ref(loadUnlocked())
const picked = ref(unlocked.value)

let game: HordeGameHandle | null = null

const tip = computed(() => LEVELS.find((l) => l.id === picked.value)?.tip ?? '')
const muted = ref(false)

function toggleMute() {
  game?.toggleMute()
  muted.value = !muted.value
}

function loadUnlocked(): number {
  try {
    const v = Number(localStorage.getItem(STORE_KEY))
    if (Number.isFinite(v) && v >= 1) return Math.min(MAX_LEVEL, Math.floor(v))
  } catch {
    /* 隐私模式下拿不到 localStorage，当作第 1 关 */
  }
  return 1
}

function saveUnlocked(n: number) {
  try {
    localStorage.setItem(STORE_KEY, String(n))
  } catch {
    /* 忽略 */
  }
}

async function start(level: number) {
  picked.value = level
  playing.value = true
  await nextTick()

  const canvas = canvasRef.value
  if (!canvas) return

  game?.destroy()
  game = createHordeGame(canvas, {
    level,
    onEvent: (e) => {
      if (e.type === 'win' && e.level >= unlocked.value && e.level < MAX_LEVEL) {
        unlocked.value = e.level + 1
        saveUnlocked(unlocked.value)
      }
    },
  })

  if (import.meta.env.DEV) {
    const w = window as Window & { __hordeGame?: HordeGameHandle; __hordePlan?: unknown }
    w.__hordeGame = game
    // 调试用：把这一关的门位与路长暴露出来，方便自动化试玩对准车道
    const lv = LEVELS.find((l) => l.id === level)
    w.__hordePlan = lv ? { length: lv.length, gates: lv.gates } : null
  }

  game.start()
}

function destroy() {
  game?.destroy()
  game = null
}

function backHome() {
  destroy()
  playing.value = false
  emit('back')
}

onBeforeUnmount(destroy)
</script>

<template>
  <div class="game-container">
    <header class="game-header">
      <button class="back-btn" @click="backHome">← 返回</button>
      <span class="title">无尽火线</span>
      <button v-if="playing" class="sound-btn" @click="toggleMute">
        {{ muted ? '静音' : '有声' }}
      </button>
      <span v-else class="sound-spacer"></span>
    </header>

    <div class="stage-wrap">
      <div v-if="!playing" class="start-screen">
        <div class="cover" aria-hidden="true">
          <div class="cover-road"></div>
          <div class="cover-gates">
            <span class="gate gold">×2</span>
            <span class="gate red">−15</span>
          </div>
          <div class="cover-crowd">
            <i v-for="n in 20" :key="n"></i>
          </div>
          <div class="cover-cap">滑到金门，兵力翻倍</div>
        </div>
        <h2>无尽火线</h2>
        <p>左右滑动带着队伍往前走，穿数字门翻倍兵力，撞上丧尸就是掉人。</p>
        <p class="hint">英雄会在队首自动开火 · 兵力归零即失败 · 一局约 1 分钟</p>

        <div class="levels">
          <button
            v-for="lv in LEVELS"
            :key="lv.id"
            class="level"
            :class="{ locked: lv.id > unlocked, active: lv.id === picked }"
            :disabled="lv.id > unlocked"
            @click="picked = lv.id"
          >
            <span class="num">{{ lv.id }}</span>
            <span class="name">{{ lv.id > unlocked ? '未解锁' : lv.name }}</span>
          </button>
        </div>

        <p class="tip">{{ tip }}</p>

        <button class="start-btn" @click="start(picked)">
          开始第 {{ picked }} 关
        </button>
      </div>

      <div v-else class="stage">
        <canvas ref="canvasRef" class="stage-canvas" role="img" aria-label="无尽火线 游戏战场"></canvas>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game-container {
  width: 100%;
  height: 100vh;
  height: 100dvh;
  background: radial-gradient(circle at 50% 0%, #16283f 0%, #0d1622 55%, #080d14 100%);
  display: flex;
  flex-direction: column;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
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
  color: #dfe9f5;
  padding: 8px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  -webkit-tap-highlight-color: transparent;
}

.back-btn:active {
  background: rgba(255, 255, 255, 0.2);
}

.title {
  color: #8fc8ff;
  font-size: 15px;
  letter-spacing: 0.08em;
}

.sound-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.22);
  color: #cfe0f2;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  min-width: 62px;
  -webkit-tap-highlight-color: transparent;
}

.sound-btn:active {
  background: rgba(255, 255, 255, 0.18);
}

.sound-spacer {
  display: inline-block;
  min-width: 62px;
}

.stage-wrap {
  flex: 1;
  min-height: 0;
  display: grid;
  place-items: center;
  container-type: size;
  padding: 0 12px 12px;
  overflow: hidden;
}

.stage {
  width: min(100cqw, 56.25cqh);
  aspect-ratio: 9 / 16;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.6);
}

.stage-canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
}

.start-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #dfe9f5;
  text-align: center;
  padding: 8px 20px;
  max-height: 100%;
  overflow-y: auto;
}

.cover {
  position: relative;
  width: min(78vw, 300px);
  aspect-ratio: 16 / 11;
  border-radius: 12px;
  background: linear-gradient(160deg, #2b4a6f 0%, #132033 60%, #0b131d 100%);
  border: 1px solid rgba(120, 180, 255, 0.25);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 8px;
  overflow: hidden;
}

.cover-road {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 52%;
  transform: translateX(-50%);
  background: linear-gradient(180deg, rgba(74, 96, 124, 0.5), rgba(38, 52, 72, 0.5));
  border-left: 1px dashed rgba(255, 255, 255, 0.16);
  border-right: 1px dashed rgba(255, 255, 255, 0.16);
}

.cover-gates {
  position: relative;
  display: flex;
  gap: 6px;
  width: 74%;
}

.cover-gates .gate {
  flex: 1;
  padding: 7px 0;
  border-radius: 6px;
  font-size: 24px;
  font-weight: 900;
  color: #fff;
  text-align: center;
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.35);
}

.cover-gates .gold {
  background: linear-gradient(180deg, #e0a12c, #b57a15);
}

.cover-gates .red {
  background: linear-gradient(180deg, #c0392b, #8e2a1f);
}

.cover-crowd {
  position: relative;
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 3px;
  width: 56%;
}

.cover-crowd i {
  display: block;
  aspect-ratio: 1;
  border-radius: 2px;
  background: linear-gradient(180deg, #6aa6e0, #3b6ea8);
}

.cover-cap {
  position: relative;
  font-size: 12px;
  color: rgba(226, 238, 252, 0.62);
}

.start-screen h2 {
  font-size: 30px;
  margin: 4px 0 2px;
  color: #eaf3ff;
}

.start-screen p {
  font-size: 14px;
  opacity: 0.82;
  margin: 0;
  line-height: 1.6;
  max-width: 26em;
}

.start-screen .hint {
  font-size: 12.5px;
  opacity: 0.55;
  margin-top: 2px;
}

.levels {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  width: min(100%, 360px);
  margin-top: 14px;
}

.tip {
  max-width: 26em;
  margin: 12px 0 0;
  font-size: 13px;
  line-height: 1.55;
  color: rgba(226, 238, 252, 0.6);
}

.level {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 4px;
  border-radius: 10px;
  border: 1px solid rgba(140, 190, 255, 0.28);
  background: rgba(255, 255, 255, 0.06);
  color: #dfe9f5;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.level .num {
  font-size: 17px;
  font-weight: 800;
}

.level .name {
  font-size: 10px;
  opacity: 0.6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.level.active {
  border-color: #e0a12c;
  background: rgba(224, 161, 44, 0.16);
}

.level.locked {
  opacity: 0.35;
  cursor: default;
}

.start-btn {
  margin-top: 16px;
  background: linear-gradient(135deg, #3d8bfd 0%, #1f5fbf 100%);
  border: none;
  color: #f2f8ff;
  padding: 13px 44px;
  border-radius: 24px;
  font-size: 17px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 8px 22px rgba(31, 95, 191, 0.45);
  -webkit-tap-highlight-color: transparent;
}

.start-btn:active {
  transform: scale(0.98);
}

@media (max-width: 480px) {
  .game-header {
    padding: 10px 12px;
  }

  .stage-wrap {
    padding: 0 8px 8px;
  }

  .start-screen h2 {
    font-size: 26px;
  }

  .levels {
    gap: 6px;
  }
}
</style>