<template>
  <div
    ref="ribbonContainerRef"
    class="ribbon-container"
    :class="[
      { active: active },
      { 'is-osx': isOsx },
      { frameless: titleBarStyle === 'custom' }
    ]"
  >
    <!-- Left Section: Menu items and History (Undo/Redo) -->
    <div
      class="ribbon-left"
      :class="{ 'mac-traffic-lights': isOsx && titleBarStyle === 'custom' }"
    >
      <menu-bar />
    </div>

    <!-- Drag Region 1 -->
    <div
      class="ribbon-drag-region"
      @dblclick.stop="handleDblClick"
    />

    <!-- Center Section: Formatting Toolbar -->
    <div class="ribbon-center">
      <format-toolbar :is-compact="isCompact" />
    </div>

    <!-- Drag Region 2 -->
    <div
      class="ribbon-drag-region"
      @dblclick.stop="handleDblClick"
    />

    <!-- Right Section: Statistics, Settings, Window Controls -->
    <div class="ribbon-right">
      <document-statistics
        v-if="wordCount"
        :pathname="pathname"
        :word-count="wordCount"
        :selection-word-count="selectionWordCount"
        :is-saved="isSaved"
        :read-only="!!currentFile?.readOnly"
        :mode-changing="!!currentFile?.modeChanging"
        @toggle-reading="setReadingMode"
      />

      <cogwheel-menu />

      <window-controls v-if="showWindowControls" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import { isMac as isOsxPlatform } from '@/util'
import { usePreferencesStore } from '@/store/preferences'
import { useEditorStore } from '@/store/editor'
import { buildWindowTitle } from '@/components/titleBar/windowTitle'
import type { FileWordCount } from '@shared/types/files'
import MenuBar from './menuBar.vue'
import FormatToolbar from './formatToolbar.vue'
import CogwheelMenu from './cogwheelMenu.vue'
import WindowControls from './windowControls.vue'
import DocumentStatistics from '@/components/titleBar/documentStatistics.vue'

interface ProjectInfo {
  name?: string
}

const props = defineProps<{
  project?: ProjectInfo | null
  pathname?: string
  filename?: string
  active?: boolean
  wordCount?: FileWordCount | null
  selectionWordCount?: FileWordCount | null
  platform?: string
  isSaved?: boolean
}>()

const isOsx = isOsxPlatform
const preferencesStore = usePreferencesStore()
const editorStore = useEditorStore()

const { titleBarStyle } = storeToRefs(preferencesStore)
const { currentFile } = storeToRefs(editorStore)

const ribbonContainerRef = ref<HTMLElement | null>(null)
const isFullScreen = ref(false)
const isCompact = ref(false)

let resizeObserver: ResizeObserver | null = null

const showWindowControls = computed(() => {
  return titleBarStyle.value === 'custom' && !isFullScreen.value && !isOsx
})

watch(
  () => [props.filename, props.project?.name] as const,
  ([filename, projectName]) => {
    document.title = buildWindowTitle(filename, projectName ?? '', isOsx)
  },
  { immediate: true }
)

const handleDblClick = () => {
  if (isOsx) {
    if (isFullScreen.value) {
      window.electron.windowControl.setFullScreen(false)
    } else {
      window.electron.windowControl.toggleMaximize()
    }
  } else {
    window.electron.windowControl.toggleMaximize()
  }
}

const setReadingMode = (readOnly: boolean): void => {
  if (currentFile.value) void editorStore.SET_READ_ONLY(currentFile.value.id, readOnly)
}

const onEnterFullScreen = () => {
  isFullScreen.value = true
}

const onLeaveFullScreen = () => {
  isFullScreen.value = false
}

let offEnterFS: (() => void) | undefined
let offLeaveFS: (() => void) | undefined

onMounted(async () => {
  try {
    isFullScreen.value = await window.electron.windowControl.isFullScreen()
  } catch {
    /* best effort */
  }

  if (ribbonContainerRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        isCompact.value = entry.contentRect.width < 960
      }
    })
    resizeObserver.observe(ribbonContainerRef.value)
  }

  offEnterFS = window.electron.ipcRenderer.on('mt::window-enter-full-screen', onEnterFullScreen)
  offLeaveFS = window.electron.ipcRenderer.on('mt::window-leave-full-screen', onLeaveFullScreen)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  offEnterFS?.()
  offLeaveFS?.()
})
</script>

<style scoped>
.ribbon-container {
  display: flex;
  align-items: center;
  height: var(--titleBarHeight);
  background: var(--editorBgColor);
  border-bottom: 1px solid rgba(128, 128, 128, 0.15);
  box-sizing: border-box;
  user-select: none;
  position: relative;
  z-index: 10;
  padding: 0 4px;
}

.ribbon-drag-region {
  flex: 1;
  height: 100%;
  -webkit-app-region: drag;
  min-width: 8px;
}

.ribbon-left {
  display: flex;
  align-items: center;
  height: 100%;
  -webkit-app-region: no-drag;
}

.ribbon-left.mac-traffic-lights {
  padding-left: 72px;
}

.ribbon-center {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  -webkit-app-region: no-drag;
}

.ribbon-right {
  display: flex;
  align-items: center;
  height: 100%;
  gap: 2px;
  -webkit-app-region: no-drag;
}
</style>
