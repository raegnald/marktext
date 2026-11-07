<template>
  <div class="ribbon-menu-bar">
    <div class="menu-items">
      <button
        type="button"
        class="menu-button"
        @click.stop="openMenu('file', $event)"
      >
        File
      </button>
      <button
        type="button"
        class="menu-button"
        @click.stop="openMenu('edit', $event)"
      >
        Edit
      </button>
      <button
        type="button"
        class="menu-button"
        @click.stop="openMenu('view', $event)"
      >
        View
      </button>
    </div>

    <div class="menu-divider" />

    <div class="history-actions">
      <icon-tooltip :content="`Undo (${modKey}+Z)`">
        <button
          type="button"
          class="history-btn"
          :disabled="!canUndo"
          :aria-label="`Undo (${modKey}+Z)`"
          @click.stop="ribbonStore.undo()"
        >
          <svg
            width="15"
            height="15"
            :viewBox="icons.undo.viewBox"
          >
            <path
              :d="icons.undo.path"
              fill="currentColor"
            />
          </svg>
        </button>
      </icon-tooltip>

      <icon-tooltip :content="`Redo (${modKey}+Y)`">
        <button
          type="button"
          class="history-btn"
          :disabled="!canRedo"
          :aria-label="`Redo (${modKey}+Y)`"
          @click.stop="ribbonStore.redo()"
        >
          <svg
            width="15"
            height="15"
            :viewBox="icons.redo.viewBox"
          >
            <path
              :d="icons.redo.path"
              fill="currentColor"
            />
          </svg>
        </button>
      </icon-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { isMac } from '@/util'
import { useRibbonStore } from '@/store/ribbon'
import IconTooltip from '@/components/iconTooltip/index.vue'
import { icons } from './icons'

const ribbonStore = useRibbonStore()
const { canUndo, canRedo } = storeToRefs(ribbonStore)

const modKey = isMac ? 'Cmd' : 'Ctrl'

const openMenu = (name: 'file' | 'edit' | 'view', event: MouseEvent) => {
  const target = event.currentTarget as HTMLElement | null
  if (!target) return
  const rect = target.getBoundingClientRect()
  window.electron.windowControl.popupSubmenu(name, {
    x: Math.round(rect.left),
    y: Math.round(rect.bottom)
  })
}
</script>

<style scoped>
.ribbon-menu-bar {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  -webkit-app-region: no-drag;
}

.menu-items {
  display: inline-flex;
  align-items: center;
  gap: 1px;
}

.menu-button {
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

.menu-button:hover {
  background: rgba(128, 128, 128, 0.12);
}

.menu-button:active {
  background: rgba(128, 128, 128, 0.2);
}

.menu-divider {
  width: 1px;
  height: 18px;
  background: rgba(128, 128, 128, 0.22);
  margin: 0 4px;
}

.history-actions {
  display: inline-flex;
  align-items: center;
  gap: 1px;
}

.history-btn {
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
  transition: background-color 0.12s ease, opacity 0.12s ease;
}

.history-btn:hover:not(:disabled) {
  background: rgba(128, 128, 128, 0.12);
}

.history-btn:active:not(:disabled) {
  background: rgba(128, 128, 128, 0.2);
}

.history-btn:disabled {
  opacity: 0.38;
  cursor: default;
}
</style>
