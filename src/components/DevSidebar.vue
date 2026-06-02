<script setup lang="ts">
import { ref } from 'vue'
import TextTools from './TextTools.vue'
import CodeTools from './CodeTools.vue'

type ToolType = 'text' | 'code'

const isOpen = ref(false)
const activeTool = ref<ToolType | null>(null)

const tools = [
  { id: 'text' as ToolType, icon: '📝', label: '文本转换' },
  { id: 'code' as ToolType, icon: '🔧', label: '代码工具' },
]

function toggleSidebar() {
  isOpen.value = !isOpen.value
  if (!isOpen.value) activeTool.value = null
}

function selectTool(toolId: ToolType) {
  if (activeTool.value === toolId) {
    activeTool.value = null
  } else {
    activeTool.value = toolId
    isOpen.value = true
  }
}
</script>

<template>
  <div class="sidebar-wrapper" :class="{ open: isOpen }">
    <!-- 悬浮按钮 -->
    <button
      class="toggle-btn"
      :class="{ active: isOpen }"
      @click="toggleSidebar"
      title="开发者工具"
    >
      ⚙
    </button>

    <!-- 工具栏 -->
    <div class="sidebar" v-show="isOpen">
      <div class="sidebar-header">
        <span class="sidebar-title">开发者工具</span>
        <button class="close-btn" @click="toggleSidebar">✕</button>
      </div>

      <!-- 工具图标列表 -->
      <div class="tool-icons">
        <button
          v-for="tool in tools"
          :key="tool.id"
          :class="['tool-icon', { active: activeTool === tool.id }]"
          @click="selectTool(tool.id)"
          :title="tool.label"
        >
          <span class="icon">{{ tool.icon }}</span>
          <span class="label">{{ tool.label }}</span>
        </button>
      </div>

      <!-- 工具内容面板 -->
      <div class="tool-content" v-if="activeTool">
        <TextTools v-if="activeTool === 'text'" />
        <CodeTools v-if="activeTool === 'code'" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.sidebar-wrapper {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}

.toggle-btn {
  width: 40px;
  height: 40px;
  background: #667eea;
  border: none;
  border-radius: 8px 0 0 8px;
  color: white;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: -2px 2px 8px rgba(0, 0, 0, 0.3);
}

.toggle-btn:hover {
  background: #5a6fd6;
  transform: translateX(-4px);
}

.toggle-btn.active {
  background: #764ba2;
}

.sidebar {
  width: 320px;
  height: 500px;
  background: #1e2130;
  border-radius: 12px 0 0 12px;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar-title {
  color: white;
  font-size: 14px;
  font-weight: 600;
}

.close-btn {
  width: 24px;
  height: 24px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.tool-icons {
  display: flex;
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.tool-icon {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid transparent;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.2s;
}

.tool-icon:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.tool-icon.active {
  background: rgba(102, 126, 234, 0.2);
  border-color: #667eea;
  color: white;
}

.tool-icon .icon {
  font-size: 18px;
}

.tool-icon .label {
  font-size: 11px;
}

.tool-content {
  flex: 1;
  overflow: hidden;
}
</style>
