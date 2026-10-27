<script setup lang="ts">
import { ref } from 'vue'
import GameCard from './components/GameCard.vue'
import BalloonGame from './components/BalloonGame.vue'
import BrickGame from './components/BrickGame.vue'
import DevSidebar from './components/DevSidebar.vue'

type View = 'home' | 'balloon-game' | 'brick-game'
const currentView = ref<View>('home')

function openImageTool() {
  window.location.assign(`${import.meta.env.BASE_URL}image-tool/`)
}
</script>

<template>
  <DevSidebar />

  <div v-if="currentView === 'home'">
    <h1 class="visually-hidden">lite-joy 小游戏与实用工具</h1>
    <section class="home-section">
      <h2 class="section-title">小游戏</h2>
      <div class="card-grid">
        <GameCard
          title="气球爆炸"
          description="点击气球获得分数，60秒内尽量多点击！"
          emoji="🎈"
          @play="currentView = 'balloon-game'"
        />
        <GameCard
          title="打砖块"
          description="移动挡板反弹小球，击破所有砖块！"
          emoji="🧱"
          @play="currentView = 'brick-game'"
        />
      </div>
    </section>

    <section class="home-section">
      <h2 class="section-title">实用工具</h2>
      <div class="card-grid">
        <GameCard
          title="轻照 · 证件照"
          description="本地裁剪、压缩、换底，内置 15 种证件照规格，图片不上传。"
          emoji="📷"
          action-label="打开工具"
          @play="openImageTool"
        />
      </div>
    </section>
  </div>
  <BalloonGame
    v-else-if="currentView === 'balloon-game'"
    @back="currentView = 'home'"
  />
  <BrickGame
    v-else-if="currentView === 'brick-game'"
    @back="currentView = 'home'"
  />
</template>

<style scoped>
.home-section {
  padding: 48px 24px;
  max-width: 800px;
  margin: 0 auto;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

.home-section + .home-section {
  padding-top: 0;
}

.section-title {
  font-size: 28px;
  margin-bottom: 24px;
  color: #2c3e50;
}

.card-grid {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

@media (max-width: 640px) {
  .home-section {
    padding: 32px 16px;
  }

  .home-section + .home-section {
    padding-top: 8px;
  }

  .section-title {
    margin-bottom: 16px;
    font-size: 24px;
    text-align: left;
  }

  .card-grid {
    gap: 16px;
  }
}
</style>
