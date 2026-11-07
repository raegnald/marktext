<template>
  <div
    ref="toolbarRef"
    class="format-toolbar"
  >
    <!-- Heading Selector (always visible) -->
    <heading-select />

    <div class="toolbar-divider" />

    <!-- Wide Mode: Full toolbar buttons -->
    <template v-if="!effectiveCompact">
      <!-- Inline Formats -->
      <div class="toolbar-group">
        <icon-tooltip
          v-for="item in inlineButtons"
          :key="item.id"
          :content="item.tooltip"
        >
          <button
            type="button"
            class="ribbon-btn"
            :class="{ 'is-active': isFormatActive(item.id) }"
            :aria-label="item.tooltip"
            @click.stop="handleInlineClick(item.id)"
          >
            <svg
              class="ribbon-icon"
              width="15"
              height="15"
              :viewBox="item.icon.viewBox"
            >
              <path
                :d="item.icon.path"
                fill="currentColor"
              />
            </svg>
          </button>
        </icon-tooltip>
      </div>

      <div class="toolbar-divider" />

      <!-- Block Formats -->
      <div class="toolbar-group">
        <icon-tooltip
          v-for="item in blockButtons"
          :key="item.id"
          :content="item.tooltip"
        >
          <button
            type="button"
            class="ribbon-btn"
            :class="{ 'is-active': isBlockActive(item.id) }"
            :aria-label="item.tooltip"
            @click.stop="handleBlockClick(item.id)"
          >
            <svg
              class="ribbon-icon"
              width="15"
              height="15"
              :viewBox="item.icon.viewBox"
            >
              <path
                :d="item.icon.path"
                fill="currentColor"
              />
            </svg>
          </button>
        </icon-tooltip>
      </div>
    </template>

    <!-- Compact Mode (<960px): 3 Category Overflow Containers -->
    <template v-else>
      <div class="toolbar-group compact-categories">
        <!-- 1. Text Category -->
        <div class="category-wrapper">
          <button
            type="button"
            class="category-btn"
            aria-haspopup="menu"
            :aria-expanded="openCategory === 'text'"
            @click.stop="toggleCategory('text')"
          >
            <span class="category-label">Text</span>
            <svg
              class="chevron-icon"
              :class="{ 'is-open': openCategory === 'text' }"
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
            v-if="openCategory === 'text'"
            class="category-dropdown"
            role="menu"
          >
            <button
              v-for="item in inlineButtons"
              :key="item.id"
              type="button"
              class="dropdown-item"
              :class="{ 'is-active': isFormatActive(item.id) }"
              role="menuitem"
              @click.stop="executeCategoryAction('inline', item.id)"
            >
              <svg
                class="dropdown-icon"
                width="15"
                height="15"
                :viewBox="item.icon.viewBox"
              >
                <path
                  :d="item.icon.path"
                  fill="currentColor"
                />
              </svg>
              <span class="dropdown-item-label">{{ item.label }}</span>
              <span class="dropdown-item-shortcut">{{ item.shortcut }}</span>
            </button>
          </div>
        </div>

        <!-- 2. Lists Category -->
        <div class="category-wrapper">
          <button
            type="button"
            class="category-btn"
            aria-haspopup="menu"
            :aria-expanded="openCategory === 'lists'"
            @click.stop="toggleCategory('lists')"
          >
            <span class="category-label">Lists</span>
            <svg
              class="chevron-icon"
              :class="{ 'is-open': openCategory === 'lists' }"
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
            v-if="openCategory === 'lists'"
            class="category-dropdown"
            role="menu"
          >
            <button
              v-for="item in listButtons"
              :key="item.id"
              type="button"
              class="dropdown-item"
              :class="{ 'is-active': isBlockActive(item.id) }"
              role="menuitem"
              @click.stop="executeCategoryAction('block', item.id)"
            >
              <svg
                class="dropdown-icon"
                width="15"
                height="15"
                :viewBox="item.icon.viewBox"
              >
                <path
                  :d="item.icon.path"
                  fill="currentColor"
                />
              </svg>
              <span class="dropdown-item-label">{{ item.label }}</span>
              <span class="dropdown-item-shortcut">{{ item.shortcut }}</span>
            </button>
          </div>
        </div>

        <!-- 3. Insert Category -->
        <div class="category-wrapper">
          <button
            type="button"
            class="category-btn"
            aria-haspopup="menu"
            :aria-expanded="openCategory === 'insert'"
            @click.stop="toggleCategory('insert')"
          >
            <span class="category-label">Insert</span>
            <svg
              class="chevron-icon"
              :class="{ 'is-open': openCategory === 'insert' }"
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
            v-if="openCategory === 'insert'"
            class="category-dropdown"
            role="menu"
          >
            <button
              v-for="item in insertButtons"
              :key="item.id"
              type="button"
              class="dropdown-item"
              :class="{ 'is-active': item.isFormat ? isFormatActive(item.id) : isBlockActive(item.id) }"
              role="menuitem"
              @click.stop="executeCategoryAction(item.isFormat ? 'inline' : 'block', item.id)"
            >
              <svg
                class="dropdown-icon"
                width="15"
                height="15"
                :viewBox="item.icon.viewBox"
              >
                <path
                  :d="item.icon.path"
                  fill="currentColor"
                />
              </svg>
              <span class="dropdown-item-label">{{ item.label }}</span>
              <span class="dropdown-item-shortcut">{{ item.shortcut }}</span>
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { isMac } from '@/util'
import { useRibbonStore } from '@/store/ribbon'
import IconTooltip from '@/components/iconTooltip/index.vue'
import HeadingSelect from './headingSelect.vue'
import { icons } from './icons'

const props = defineProps<{
  isCompact?: boolean
}>()

const ribbonStore = useRibbonStore()
const { activeFormats, activeBlock } = storeToRefs(ribbonStore)

const toolbarRef = ref<HTMLElement | null>(null)
const internalCompact = ref(false)
const openCategory = ref<'text' | 'lists' | 'insert' | null>(null)

const effectiveCompact = computed(() => {
  return props.isCompact !== undefined ? props.isCompact : internalCompact.value
})

const modKey = isMac ? 'Cmd' : 'Ctrl'
const altKey = isMac ? 'Option' : 'Alt'

interface InlineButtonItem {
  id: string
  label: string
  shortcut: string
  tooltip: string
  icon: (typeof icons)[keyof typeof icons]
}

const inlineButtons = computed<InlineButtonItem[]>(() => [
  { id: 'strong', label: 'Bold', shortcut: `${modKey}+B`, tooltip: `Bold (${modKey}+B)`, icon: icons.bold },
  { id: 'em', label: 'Italic', shortcut: `${modKey}+I`, tooltip: `Italic (${modKey}+I)`, icon: icons.italic },
  { id: 'u', label: 'Underline', shortcut: `${modKey}+U`, tooltip: `Underline (${modKey}+U)`, icon: icons.underline },
  { id: 'del', label: 'Strikethrough', shortcut: `${modKey}+D`, tooltip: `Strikethrough (${modKey}+D)`, icon: icons.strikethrough },
  { id: 'mark', label: 'Highlight', shortcut: `${modKey}+Shift+H`, tooltip: `Highlight (${modKey}+Shift+H)`, icon: icons.highlight },
  { id: 'inline_code', label: 'Inline Code', shortcut: `${modKey}+\``, tooltip: `Inline Code (${modKey}+\`)`, icon: icons.inlineCode },
  { id: 'link', label: 'Link', shortcut: `${modKey}+L`, tooltip: `Link (${modKey}+L)`, icon: icons.link },
  { id: 'inline_math', label: 'Inline Math', shortcut: `${modKey}+M`, tooltip: `Inline Math (${modKey}+M)`, icon: icons.inlineMath }
])

interface BlockButtonItem {
  id: string
  label: string
  shortcut: string
  tooltip: string
  icon: (typeof icons)[keyof typeof icons]
  isFormat?: boolean
}

const blockButtons = computed<BlockButtonItem[]>(() => [
  { id: 'mathblock', label: 'Math Block', shortcut: `${modKey}+${altKey}+M`, tooltip: `Math Block (${modKey}+${altKey}+M)`, icon: icons.mathBlock },
  { id: 'blockquote', label: 'Quote Block', shortcut: `${modKey}+${altKey}+Q`, tooltip: `Quote Block (${modKey}+${altKey}+Q)`, icon: icons.quote },
  { id: 'ul-bullet', label: 'Bullet List', shortcut: `${modKey}+${altKey}+U`, tooltip: `Bullet List (${modKey}+${altKey}+U)`, icon: icons.bulletList },
  { id: 'ol-order', label: 'Numbered List', shortcut: `${modKey}+${altKey}+O`, tooltip: `Numbered List (${modKey}+${altKey}+O)`, icon: icons.numberedList },
  { id: 'ul-task', label: 'Task List', shortcut: `${modKey}+${altKey}+X`, tooltip: `Task List (${modKey}+${altKey}+X)`, icon: icons.taskList },
  { id: 'pre', label: 'Code Fence', shortcut: `${modKey}+${altKey}+C`, tooltip: `Code Fence (${modKey}+${altKey}+C)`, icon: icons.codeFence },
  { id: 'table', label: 'Table', shortcut: `${modKey}+${altKey}+T`, tooltip: `Table (${modKey}+${altKey}+T)`, icon: icons.table },
  { id: 'hr', label: 'Horizontal Rule', shortcut: `${modKey}+${altKey}+-`, tooltip: `Horizontal Rule (${modKey}+${altKey}+-)`, icon: icons.horizontalRule }
])

const listButtons = computed<BlockButtonItem[]>(() => [
  { id: 'ul-bullet', label: 'Bullet List', shortcut: `${modKey}+${altKey}+U`, tooltip: `Bullet List (${modKey}+${altKey}+U)`, icon: icons.bulletList },
  { id: 'ol-order', label: 'Numbered List', shortcut: `${modKey}+${altKey}+O`, tooltip: `Numbered List (${modKey}+${altKey}+O)`, icon: icons.numberedList },
  { id: 'ul-task', label: 'Task List', shortcut: `${modKey}+${altKey}+X`, tooltip: `Task List (${modKey}+${altKey}+X)`, icon: icons.taskList }
])

const insertButtons = computed<BlockButtonItem[]>(() => [
  { id: 'blockquote', label: 'Quote Block', shortcut: `${modKey}+${altKey}+Q`, tooltip: `Quote Block (${modKey}+${altKey}+Q)`, icon: icons.quote },
  { id: 'table', label: 'Table', shortcut: `${modKey}+${altKey}+T`, tooltip: `Table (${modKey}+${altKey}+T)`, icon: icons.table },
  { id: 'pre', label: 'Code Fence', shortcut: `${modKey}+${altKey}+C`, tooltip: `Code Fence (${modKey}+${altKey}+C)`, icon: icons.codeFence },
  { id: 'mathblock', label: 'Math Block', shortcut: `${modKey}+${altKey}+M`, tooltip: `Math Block (${modKey}+${altKey}+M)`, icon: icons.mathBlock },
  { id: 'hr', label: 'Horizontal Rule', shortcut: `${modKey}+${altKey}+-`, tooltip: `Horizontal Rule (${modKey}+${altKey}+-)`, icon: icons.horizontalRule },
  { id: 'image', label: 'Image', shortcut: `${modKey}+${altKey}+I`, tooltip: `Image (${modKey}+${altKey}+I)`, icon: icons.image, isFormat: true }
])

const isFormatActive = (formatId: string): boolean => {
  return !!activeFormats.value[formatId]
}

const isBlockActive = (blockId: string): boolean => {
  return activeBlock.value === blockId
}

const handleInlineClick = (formatId: string) => {
  ribbonStore.applyFormat(formatId)
}

const handleBlockClick = (blockId: string) => {
  ribbonStore.applyParagraph(blockId)
}

const toggleCategory = (category: 'text' | 'lists' | 'insert') => {
  // Exclusive behavior: opening one category closes all others
  openCategory.value = openCategory.value === category ? null : category
}

const executeCategoryAction = (actionType: 'inline' | 'block', id: string) => {
  if (actionType === 'inline') {
    ribbonStore.applyFormat(id)
  } else {
    ribbonStore.applyParagraph(id)
  }
  openCategory.value = null
}

const handleClickOutside = (event: MouseEvent) => {
  if (toolbarRef.value && !toolbarRef.value.contains(event.target as Node)) {
    openCategory.value = null
  }
}

let toolbarResizeObserver: ResizeObserver | null = null

onMounted(() => {
  window.addEventListener('click', handleClickOutside)
  if (toolbarRef.value && typeof ResizeObserver !== 'undefined' && props.isCompact === undefined) {
    toolbarResizeObserver = new ResizeObserver(() => {
      internalCompact.value = window.innerWidth < 960
    })
    toolbarResizeObserver.observe(toolbarRef.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('click', handleClickOutside)
  toolbarResizeObserver?.disconnect()
})
</script>

<style scoped>
.format-toolbar {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  -webkit-app-region: no-drag;
}

.toolbar-group {
  display: inline-flex;
  align-items: center;
  gap: 1px;
}

.toolbar-divider {
  width: 1px;
  height: 18px;
  background: rgba(128, 128, 128, 0.22);
  margin: 0 4px;
}

.ribbon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--editorColor);
  cursor: pointer;
  user-select: none;
  transition: background-color 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.ribbon-btn:hover {
  background: rgba(128, 128, 128, 0.12);
}

.ribbon-btn:active {
  background: rgba(128, 128, 128, 0.2);
}

.ribbon-btn.is-active {
  background: rgba(128, 128, 128, 0.18);
  color: var(--editorColor);
  border: 1px solid transparent;
  box-shadow: none;
}

.ribbon-btn.is-active:hover {
  background: rgba(128, 128, 128, 0.24);
}

.ribbon-icon {
  display: block;
}

/* Compact Categories */
.compact-categories {
  gap: 2px;
}

.category-wrapper {
  position: relative;
  display: inline-flex;
}

.category-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 8px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--editorColor);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.12s ease;
}

.category-btn:hover {
  background: rgba(128, 128, 128, 0.12);
}

.category-btn:active {
  background: rgba(128, 128, 128, 0.2);
}

.category-label {
  white-space: nowrap;
}

.chevron-icon {
  color: var(--iconColor);
  transition: transform 0.2s ease;
}

.chevron-icon.is-open {
  transform: rotate(180deg);
}

.category-dropdown {
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

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--editorColor);
  font-family: inherit;
  font-size: 12.5px;
  cursor: pointer;
  transition: background-color 0.12s ease;
}

.dropdown-item:hover {
  background: rgba(128, 128, 128, 0.12);
}

.dropdown-item.is-active {
  background: rgba(128, 128, 128, 0.18);
  color: var(--editorColor);
  border: 1px solid transparent;
  box-shadow: none;
  font-weight: 600;
}

.dropdown-item.is-active:hover {
  background: rgba(128, 128, 128, 0.24);
}

.dropdown-icon {
  flex-shrink: 0;
  display: block;
}

.dropdown-item-label {
  flex: 1;
  text-align: left;
  white-space: nowrap;
}

.dropdown-item-shortcut {
  font-size: 11px;
  color: var(--editorColor50);
  font-weight: 400;
  margin-left: 12px;
  white-space: nowrap;
}
</style>
