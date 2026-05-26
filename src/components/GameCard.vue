<script setup lang="ts">
defineProps<{
  title: string
  description: string
  emoji: string
}>()

defineEmits<{
  play: []
}>()
</script>

<template>
  <div class="game-card" @click="$emit('play')">
    <div class="card-emoji">{{ emoji }}</div>
    <h3>{{ title }}</h3>
    <p>{{ description }}</p>
    <button class="play-btn">开始游戏</button>
  </div>
</template>

<style scoped>
.game-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 32px;
  color: white;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  text-align: center;
  max-width: 300px;
}

.game-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(102, 126, 234, 0.4);
}

.card-emoji {
  font-size: 64px;
  margin-bottom: 16px;
}

h3 {
  margin: 0 0 8px;
  font-size: 22px;
}

p {
  margin: 0 0 20px;
  opacity: 0.85;
  font-size: 14px;
}

.play-btn {
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.6);
  color: white;
  padding: 10px 28px;
  border-radius: 24px;
  font-size: 15px;
  cursor: pointer;
  transition: background 0.2s;
}

.play-btn:hover {
  background: rgba(255, 255, 255, 0.35);
}
</style>
