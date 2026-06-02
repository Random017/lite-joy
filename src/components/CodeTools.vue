<script setup lang="ts">
import { ref } from 'vue'

const activeTab = ref<'regex' | 'diff' | 'timestamp'>('regex')

// 正则测试
const regexPattern = ref('')
const regexFlags = ref('g')
const regexInput = ref('')
const regexMatches = ref<string[]>([])

function testRegex() {
  try {
    const regex = new RegExp(regexPattern.value, regexFlags.value)
    const matches: string[] = []
    let match: RegExpExecArray | null

    while ((match = regex.exec(regexInput.value)) !== null) {
      matches.push(`${match.index}: "${match[0]}"`)
      if (!regexFlags.value.includes('g')) break
    }

    regexMatches.value = matches
  } catch (e) {
    regexMatches.value = [`错误: ${(e as Error).message}`]
  }
}

// 时间戳转换
const timestampInput = ref('')
const timestampOutput = ref('')
const timestampMode = ref<'toString' | 'toTimestamp'>('toString')

function convertTimestamp() {
  try {
    if (timestampMode.value === 'toString') {
      const ts = Number(timestampInput.value)
      const date = new Date(ts > 1e11 ? ts : ts * 1000)
      timestampOutput.value = [
        `本地时间: ${date.toLocaleString()}`,
        `ISO: ${date.toISOString()}`,
        `UTC: ${date.toUTCString()}`
      ].join('\n')
    } else {
      const date = new Date(timestampInput.value)
      timestampOutput.value = `秒级: ${Math.floor(date.getTime() / 1000)}\n毫秒级: ${date.getTime()}`
    }
  } catch (e) {
    timestampOutput.value = '转换错误: ' + (e as Error).message
  }
}

function copyOutput(text: string) {
  navigator.clipboard.writeText(text)
}
</script>

<template>
  <div class="tool-panel">
    <div class="tabs">
      <button
        :class="['tab', { active: activeTab === 'regex' }]"
        @click="activeTab = 'regex'"
      >正则</button>
      <button
        :class="['tab', { active: activeTab === 'timestamp' }]"
        @click="activeTab = 'timestamp'"
      >时间戳</button>
    </div>

    <div class="content">
      <!-- 正则测试 -->
      <template v-if="activeTab === 'regex'">
        <div class="regex-row">
          <span class="label">/</span>
          <input
            v-model="regexPattern"
            class="input-inline"
            placeholder="正则表达式"
            @input="testRegex"
          />
          <span class="label">/</span>
          <input
            v-model="regexFlags"
            class="input-inline small"
            placeholder="flags"
            @input="testRegex"
          />
        </div>
        <textarea
          v-model="regexInput"
          class="input-area"
          placeholder="输入测试文本..."
          @input="testRegex"
        ></textarea>
        <div class="output-label">
          <span>匹配结果 ({{ regexMatches.length }})</span>
        </div>
        <div class="matches-list">
          <div
            v-for="(match, i) in regexMatches"
            :key="i"
            class="match-item"
            @click="copyOutput(match)"
          >
            {{ match }}
          </div>
          <div v-if="regexMatches.length === 0" class="no-match">
            无匹配结果
          </div>
        </div>
      </template>

      <!-- 时间戳转换 -->
      <template v-if="activeTab === 'timestamp'">
        <div class="mode-row">
          <button
            :class="['mode-btn', { active: timestampMode === 'toString' }]"
            @click="timestampMode = 'toString'"
          >时间戳 → 字符串</button>
          <button
            :class="['mode-btn', { active: timestampMode === 'toTimestamp' }]"
            @click="timestampMode = 'toTimestamp'"
          >字符串 → 时间戳</button>
        </div>
        <input
          v-model="timestampInput"
          class="input-single"
          :placeholder="timestampMode === 'toString' ? '输入时间戳 (如 1700000000)' : '输入时间 (如 2024-01-01)'"
          @input="convertTimestamp"
        />
        <div class="output-label"><span>结果</span></div>
        <textarea
          :value="timestampOutput"
          class="output-area"
          readonly
          placeholder="转换结果..."
        ></textarea>
      </template>
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

.regex-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.label {
  color: rgba(255, 255, 255, 0.5);
  font-family: monospace;
  font-size: 14px;
}

.input-inline {
  flex: 1;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 6px 8px;
  color: white;
  font-family: monospace;
  font-size: 13px;
  outline: none;
}

.input-inline.small {
  width: 40px;
  flex: none;
}

.input-inline:focus {
  border-color: #667eea;
}

.input-single {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 8px 12px;
  color: white;
  font-size: 13px;
  outline: none;
}

.input-single:focus {
  border-color: #667eea;
}

.mode-row {
  display: flex;
  gap: 4px;
}

.mode-btn {
  flex: 1;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-btn.active {
  background: #764ba2;
  color: white;
  border-color: #764ba2;
}

.input-area,
.output-area {
  flex: 1;
  min-height: 80px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 8px;
  color: white;
  font-family: 'Consolas', monospace;
  font-size: 12px;
  resize: none;
  outline: none;
}

.input-area:focus {
  border-color: #667eea;
}

.output-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
}

.matches-list {
  flex: 1;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  padding: 4px;
}

.match-item {
  padding: 4px 8px;
  color: #81C784;
  font-family: monospace;
  font-size: 12px;
  border-radius: 3px;
  cursor: pointer;
  transition: background 0.15s;
}

.match-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.no-match {
  color: rgba(255, 255, 255, 0.3);
  text-align: center;
  padding: 16px;
  font-size: 12px;
}
</style>
