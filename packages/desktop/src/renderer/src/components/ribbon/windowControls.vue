<template>
  <div class="ribbon-window-controls">
    <icon-tooltip :content="t('titleBar.minimize')">
      <button
        type="button"
        class="control-btn"
        :aria-label="t('titleBar.minimize')"
        @click.stop="minimize"
      >
        <svg
          width="10"
          height="10"
          :viewBox="icons.minimize.viewBox"
        >
          <path
            :d="icons.minimize.path"
            fill="currentColor"
          />
        </svg>
      </button>
    </icon-tooltip>

    <icon-tooltip :content="maximizeLabel">
      <button
        type="button"
        class="control-btn"
        :aria-label="maximizeLabel"
        @click.stop="toggleMaximize"
      >
        <svg
          width="10"
          height="10"
          :viewBox="isMaximized ? icons.restore.viewBox : icons.maximize.viewBox"
        >
          <path
            :d="isMaximized ? icons.restore.path : icons.maximize.path"
            fill="currentColor"
          />
        </svg>
      </button>
    </icon-tooltip>

    <icon-tooltip :content="t('titleBar.close')">
      <button
        type="button"
        class="control-btn close-btn"
        :aria-label="t('titleBar.close')"
        @click.stop="close"
      >
        <svg
          width="10"
          height="10"
          :viewBox="icons.close.viewBox"
        >
          <path
            :d="icons.close.path"
            fill="currentColor"
          />
        </svg>
      </button>
    </icon-tooltip>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import IconTooltip from '@/components/iconTooltip/index.vue'
import { icons } from './icons'

const { t } = useI18n()

const isMaximized = ref(false)

const maximizeLabel = computed(() =>
  isMaximized.value ? t('titleBar.restore') : t('titleBar.maximize')
)

const minimize = () => {
  window.electron.windowControl.minimize()
}

const toggleMaximize = async () => {
  if (isMaximized.value) {
    window.electron.windowControl.unmaximize()
  } else {
    window.electron.windowControl.maximize()
  }
}

const close = () => {
  window.electron.windowControl.close()
}

const onMaximize = () => {
  isMaximized.value = true
}

const onUnmaximize = () => {
  isMaximized.value = false
}

let offMax: (() => void) | undefined
let offUnmax: (() => void) | undefined

onMounted(async () => {
  try {
    isMaximized.value = await window.electron.windowControl.isMaximized()
  } catch {
    /* best effort */
  }

  offMax = window.electron.ipcRenderer.on('mt::window-maximize', onMaximize)
  offUnmax = window.electron.ipcRenderer.on('mt::window-unmaximize', onUnmaximize)
})

onBeforeUnmount(() => {
  offMax?.()
  offUnmax?.()
})
</script>

<style scoped>
.ribbon-window-controls {
  display: inline-flex;
  align-items: stretch;
  height: 100%;
  -webkit-app-region: no-drag;
}

.control-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 100%;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--editorColor);
  cursor: pointer;
  user-select: none;
  transition: background-color 0.1s ease, color 0.1s ease;
}

.control-btn:hover {
  background: rgba(128, 128, 128, 0.15);
}

.control-btn:active {
  background: rgba(128, 128, 128, 0.25);
}

.control-btn.close-btn:hover {
  background: #e81123;
  color: #ffffff;
}

.control-btn.close-btn:active {
  background: #c7101f;
  color: #ffffff;
}
</style>
