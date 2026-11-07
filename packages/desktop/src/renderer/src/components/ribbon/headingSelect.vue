<template>
  <div
    ref="containerRef"
    class="heading-select-container"
  >
    <button
      type="button"
      class="heading-button"
      :class="{ 'is-active': activeBlock.startsWith('heading') }"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      :aria-label="currentFullLabel"
      :title="currentFullLabel"
      @click.stop="toggleDropdown"
    >
      <span class="heading-label">{{ currentShortLabel }}</span>
      <svg
        class="chevron-icon"
        :class="{ 'is-open': isOpen }"
        width="12"
        height="12"
        :viewBox="icons.chevronDown.viewBox"
      >
        <path
          :d="icons.chevronDown.path"
          fill="currentColor"
        />
      </svg>
    </button>

    <div
      v-if="isOpen"
      class="heading-dropdown"
      role="listbox"
    >
      <button
        v-for="item in headingItems"
        :key="item.value"
        type="button"
        class="heading-option"
        :class="[item.className, { selected: activeBlock === item.value }]"
        role="option"
        :aria-selected="activeBlock === item.value"
        @click.stop="selectHeading(item.value)"
      >
        <span class="heading-option-text">
          <span class="heading-prefix">{{ item.shortLabel }}</span>
          <span class="heading-name">{{ item.label }}</span>
        </span>
        <span class="heading-shortcut">{{ item.shortcut }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { isMac } from '@/util'
import { useRibbonStore } from '@/store/ribbon'
import { icons } from './icons'

const ribbonStore = useRibbonStore()
const { activeBlock } = storeToRefs(ribbonStore)

const containerRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)

const modKey = isMac ? 'Cmd' : 'Ctrl'

const headingItems = [
  { value: 'paragraph', shortLabel: '¶', label: 'Paragraph', shortcut: `${modKey}+0`, className: 'opt-p' },
  { value: 'heading 1', shortLabel: 'H1', label: 'Heading 1', shortcut: `${modKey}+1`, className: 'opt-h1' },
  { value: 'heading 2', shortLabel: 'H2', label: 'Heading 2', shortcut: `${modKey}+2`, className: 'opt-h2' },
  { value: 'heading 3', shortLabel: 'H3', label: 'Heading 3', shortcut: `${modKey}+3`, className: 'opt-h3' },
  { value: 'heading 4', shortLabel: 'H4', label: 'Heading 4', shortcut: `${modKey}+4`, className: 'opt-h4' },
  { value: 'heading 5', shortLabel: 'H5', label: 'Heading 5', shortcut: `${modKey}+5`, className: 'opt-h5' },
  { value: 'heading 6', shortLabel: 'H6', label: 'Heading 6', shortcut: `${modKey}+6`, className: 'opt-h6' }
]

const currentShortLabel = computed(() => {
  const match = headingItems.find((item) => item.value === activeBlock.value)
  return match ? match.shortLabel : '¶'
})

const currentFullLabel = computed(() => {
  const match = headingItems.find((item) => item.value === activeBlock.value)
  return match ? match.label : 'Paragraph'
})

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
}

const selectHeading = (value: string) => {
  ribbonStore.applyParagraph(value)
  isOpen.value = false
}

const handleClickOutside = (event: MouseEvent) => {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  window.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  window.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.heading-select-container {
  position: relative;
  display: inline-flex;
  align-items: center;
  -webkit-app-region: no-drag;
}

.heading-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  height: 28px;
  width: 46px;
  min-width: 46px;
  box-sizing: border-box;
  padding: 0 4px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--editorColor);
  font-size: 12.5px;
  font-family: inherit;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.heading-button:hover {
  background: rgba(128, 128, 128, 0.12);
}

.heading-button:active {
  background: rgba(128, 128, 128, 0.2);
}

.heading-button.is-active {
  background: rgba(128, 128, 128, 0.18);
  color: var(--editorColor);
  border: 1px solid transparent;
  box-shadow: none;
  font-weight: 600;
}

.heading-button.is-active:hover {
  background: rgba(128, 128, 128, 0.24);
}

.heading-label {
  display: inline-block;
  width: 20px;
  text-align: center;
  white-space: nowrap;
}

.chevron-icon {
  color: var(--iconColor);
  transition: transform 0.2s ease;
}

.chevron-icon.is-open {
  transform: rotate(180deg);
}

.heading-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  min-width: 175px;
  background: var(--editorBgColor);
  border: 1px solid rgba(128, 128, 128, 0.25);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  padding: 4px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.heading-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 6px 10px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--editorColor);
  font-family: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.12s ease;
}

.heading-option:hover {
  background: rgba(128, 128, 128, 0.12);
}

.heading-option.selected {
  background: rgba(128, 128, 128, 0.18);
  color: var(--editorColor);
  border: 1px solid transparent;
  box-shadow: none;
  font-weight: 600;
}

.heading-option.selected:hover {
  background: rgba(128, 128, 128, 0.24);
}

.heading-option-text {
  display: inline-flex;
  align-items: center;
}

.heading-prefix {
  display: inline-block;
  width: 24px;
  font-weight: 600;
  color: var(--editorColor70);
}

.heading-option.selected .heading-prefix {
  color: var(--editorColor);
}

.heading-name {
  margin-left: 2px;
}

.opt-h1 { font-size: 15px; font-weight: 700; }
.opt-h2 { font-size: 14px; font-weight: 700; }
.opt-h3 { font-size: 13.5px; font-weight: 600; }
.opt-h4 { font-size: 13px; font-weight: 600; }
.opt-h5 { font-size: 12.5px; font-weight: 600; }
.opt-h6 { font-size: 12px; font-weight: 600; }

.heading-shortcut {
  font-size: 11px;
  color: var(--editorColor50);
  font-weight: 400;
  margin-left: 12px;
}
</style>
