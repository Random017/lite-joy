<script setup lang="ts">
import { ref } from 'vue'

const input = ref('')
const output = ref('')
const activeTab = ref<'json' | 'base64' | 'url'>('json')

// JSON 格式化
function formatJSON() {
  try {
    output.value = JSON.stringify(JSON.parse(input.value), null, 2)
  } catch (e) {
    output.value = 'JSON 解析错误: ' + (e as Error).message
  }
}

function minifyJSON() {
  try {
    output.value = JSON.stringify(JSON.parse(input.value))
  } catch (e) {
    output.value = 'JSON 解析错误: ' + (e as Error).message
  }
}

// Base64
function encodeBase64() {
  try {
    output.value = btoa(unescape(encodeURIComponent(input.value)))
  } catch (e) {
    output.value = 'Base64 编码错误: ' + (e as Error).message
  }
}

function decodeBase64() {
  try {
    output.value = decodeURIComponent(escape(atob(input.value)))
  } catch (e) {
    output.value = 'Base64 解码错误: ' + (e as Error).message
  }
}

// URL
function encodeURL() {
  try {
    output.value = encodeURIComponent(input.value)
  } catch (e) {
    output.value = 'URL 编码错误: ' + (e as Error).message
  }
}

function decodeURL() {
  try {
    output.value = decodeURIComponent(input.value)
  } catch (e) {
    output.value = 'URL 解码错误: ' + (e as Error).message
  }
}

function copyOutput() {
  navigator.clipboard.writeText(output.value)
}
</script>

<template>
  <div class="tool-panel">
    <div class="tabs">
      <button
        :class="['tab', { active: activeTab === 'json' }]"
        @click="activeTab = 'json'"
      >JSON</button>
      <button
        :class="['tab', { active: activeTab === 'base64' }]"
        @click="activeTab = 'base64'"
      >Base64</button>
      <button
        :class="['tab', { active: activeTab === 'url' }]"
        @click="activeTab = 'url'"
      >URL</button>
    </div>

    <div class="content">
      <textarea
        v-model="input"
        class="input-area"
        placeholder="输入内容..."
      ></textarea>

      <div class="buttons">
        <template v-if="activeTab === 'json'">
          <button class="btn" @click="formatJSON">格式化</button>
          <button class="btn" @click="minifyJSON">压缩</button>
        </template>
        <template v-if="activeTab === 'base64'">
          <button class="btn" @click="encodeBase64">编码</button>
          <button class="btn" @click="decodeBase64">解码</button>
        </template>
        <template v-if="activeTab === 'url'">
          <button class="btn" @click="encodeURL">编码</button>
          <button class="btn" @click="decodeURL">解码</button>
        </template>
      </div>

      <div class="output-wrapper">
        <textarea
          :value="output"
          class="output-area"
          readonly
          placeholder="结果..."
        ></textarea>
        <button class="copy-btn" @click="copyOutput" title="复制">复制</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tool-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.tabs {
  display: flex;
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.tab {
  flex: 1;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab:hover {
  background: rgba(255, 255, 255, 0.1);
}

.tab.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 8px;
  gap: 8px;
  overflow: hidden;
}

.input-area,
.output-area {
  flex: 1;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 8px;
  color: white;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  resize: none;
  outline: none;
}

.input-area:focus,
.output-area:focus {
  border-color: #667eea;
}

.buttons {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.btn {
  padding: 8px 16px;
  background: #667eea;
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn:hover {
  background: #5a6fd6;
}

.output-wrapper {
  position: relative;
  flex: 1;
}

.copy-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 3px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.copy-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}
</style>
