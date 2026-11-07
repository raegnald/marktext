import { defineStore } from 'pinia'
import bus from '@/bus'
import { usePreferencesStore } from './preferences'

export interface RibbonState {
  activeFormats: Record<string, boolean>
  activeBlock: string
  canUndo: boolean
  canRedo: boolean
}

export const extractBlockFromAffiliation = (affiliation: Record<string, boolean>): string => {
  if (affiliation.multiplemath) return 'mathblock'
  if (affiliation.table) return 'table'
  if (affiliation.fencecode || affiliation.code || affiliation['code-block']) return 'pre'
  if (affiliation.task) return 'ul-task'
  if (affiliation.ol) return 'ol-order'
  if (affiliation.ul) return 'ul-bullet'
  if (affiliation.blockquote) return 'blockquote'
  for (let level = 1; level <= 6; level++) {
    if (affiliation[`h${level}`]) return `heading ${level}`
  }
  return 'paragraph'
}

export const useRibbonStore = defineStore('ribbon', {
  state: (): RibbonState => ({
    activeFormats: {},
    activeBlock: 'paragraph',
    canUndo: true,
    canRedo: false
  }),

  actions: {
    setActiveFormats(formats: Record<string, boolean>): void {
      this.activeFormats = formats
    },

    setActiveBlock(block: string): void {
      this.activeBlock = block
    },

    updateFromAffiliation(affiliation: Record<string, boolean>): void {
      this.activeBlock = extractBlockFromAffiliation(affiliation)
    },

    setHistoryState(canUndo: boolean, canRedo: boolean): void {
      this.canUndo = canUndo
      this.canRedo = canRedo
    },

    applyFormat(type: string): void {
      const preferencesStore = usePreferencesStore()
      if (preferencesStore.sourceCode) {
        bus.emit('source-format', type)
      } else {
        bus.emit('format', type)
      }
    },

    applyParagraph(type: string): void {
      const preferencesStore = usePreferencesStore()
      if (preferencesStore.sourceCode) {
        bus.emit('source-paragraph', type)
      } else {
        bus.emit('paragraph', type)
      }
    },

    undo(): void {
      bus.emit('undo')
    },

    redo(): void {
      bus.emit('redo')
    }
  }
})
