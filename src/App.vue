<script setup lang="ts">
import { ref } from 'vue'
import HelloWorld from './components/HelloWorld.vue'
import GameCard from './components/GameCard.vue'
import BalloonGame from './components/BalloonGame.vue'
import BrickGame from './components/BrickGame.vue'
import DevSidebar from './components/DevSidebar.vue'

type View = 'home' | 'balloon-game' | 'brick-game'
const currentView = ref<View>('home')
</script>

<template>
  <DevSidebar />

  <div v-if="currentView === 'home'">
    <HelloWorld />
    <section class="games-section">
      <h2 class="games-title">小游戏</h2>
      <div class="games-grid">
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
.games-section {
  padding: 48px 24px;
  max-width: 800px;
  margin: 0 auto;
}

.games-title {
  font-size: 28px;
  margin-bottom: 24px;
  color: #2c3e50;
}

.games-grid {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}
</style>
