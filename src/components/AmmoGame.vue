<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, shallowRef } from 'vue'
import { createAmmoGame, type AmmoGameHandle } from '../games/ammo/engine'

const emit = defineEmits<{
  back: []
}>()

const coverUrl = `${import.meta.env.BASE_URL}ammo-cover.jpg`

const canvasRef = ref<HTMLCanvasElement | null>(null)
const playing = ref(false)
const game = shallowRef<AmmoGameHandle | null>(null)

async function startGame() {
  playing.value = true
  await nextTick()

  const canvas = canvasRef.value
  if (!canvas) return

  game.value?.destroy()
  const handle = createAmmoGame(canvas)
  game.value = handle

  // 便于 E2E / 调试读取运行时状态，生产构建不保留
  if (import.meta.env.DEV) {
    ;(window as Window & { __ammoGame?: AmmoGameHandle }).__ammoGame = handle
  }

  handle.start()
}

function destroy() {
  game.value?.destroy()
  game.value = null
}

function backHome() {
  destroy()
  emit('back')
}

onBeforeUnmount(destroy)
</script>

<template>
  <div class="game-container">
    <header class="game-header">
      <button class="back-btn" @click="backHome">← 返回</button>
      <span class="title">让子弹射</span>
    </header>

    <div class="stage-wrap">
      <div v-if="!playing" class="start-screen">
        <img class="cover" :src="coverUrl" alt="让子弹射 游戏画面" />
        <h2>让子弹射</h2>
        <p>传送带造子弹，倍率门翻倍，炮塔自动开火。</p>
        <p class="hint">长按战场倾泻火力 · 点下方卡片花金币升级</p>
        <button class="start-btn" @click="startGame">开始游戏</button>
      </div>

      <div v-else class="stage">
        <canvas
          ref="canvasRef"
          class="stage-canvas"
          role="img"
          aria-label="让子弹射 游戏战场"
        ></canvas>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game-container {
  width: 100%;
  height: 100vh;
  height: 100dvh;
  background: radial-gradient(circle at 50% 0%, #3b2418 0%, #241611 55%, #170d09 100%);
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
  color: #f1e6d6;
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
  color: #e8c98a;
  font-size: 15px;
  letter-spacing: 0.08em;
}

/* 用容器查询算出「等比塞进剩余空间」的舞台尺寸，手机上不会撑破也不变形 */
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
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.55);
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
  color: #f1e6d6;
  text-align: center;
  padding: 8px 20px;
  max-height: 100%;
  overflow-y: auto;
}

.cover {
  width: min(80vw, 330px);
  height: auto;
  aspect-ratio: 960 / 627;
  object-fit: cover;
  background: #2a1a12;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
  margin-bottom: 10px;
}

.start-screen h2 {
  font-size: 30px;
  margin: 4px 0 2px;
  color: #f6e7c8;
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
  opacity: 0.58;
  margin-top: 2px;
}

.start-btn {
  margin-top: 16px;
  background: linear-gradient(135deg, #d9a13c 0%, #a8551f 100%);
  border: none;
  color: #fff8e8;
  padding: 13px 44px;
  border-radius: 24px;
  font-size: 17px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 8px 22px rgba(168, 85, 31, 0.4);
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
}
</style>
