<template>
  <div class="cogwheel-menu-wrapper">
    <icon-tooltip :content="t('preferences.title')">
      <button
        type="button"
        class="cogwheel-btn"
        :aria-label="t('preferences.title')"
        @click.stop="openCogwheelMenu"
      >
        <svg
          width="15"
          height="15"
          :viewBox="icons.cogwheel.viewBox"
        >
          <path
            :d="icons.cogwheel.path"
            fill="currentColor"
          />
        </svg>
      </button>
    </icon-tooltip>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import IconTooltip from '@/components/iconTooltip/index.vue'
import { icons } from './icons'

const { t } = useI18n()

const openCogwheelMenu = (event: MouseEvent) => {
  const target = event.currentTarget as HTMLElement | null
  if (!target) return
  const rect = target.getBoundingClientRect()
  window.electron.windowControl.popupSubmenu('cogwheel', {
    x: Math.round(rect.left),
    y: Math.round(rect.bottom)
  })
}
</script>

<style scoped>
.cogwheel-menu-wrapper {
  display: inline-flex;
  align-items: center;
  -webkit-app-region: no-drag;
}

.cogwheel-btn {
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
  transition: background-color 0.12s ease;
}

.cogwheel-btn:hover {
  background: rgba(128, 128, 128, 0.12);
}

.cogwheel-btn:active {
  background: rgba(128, 128, 128, 0.2);
}
</style>
