import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { createApp, h, nextTick, type App } from 'vue'
import ElementPlus from 'element-plus'

vi.hoisted(() => {
  const w = globalThis as unknown as { window?: { path?: { sep: string }; electron?: unknown } }
  w.window ??= {}
  w.window.path ??= { sep: '/' }
  w.window.electron ??= {
    ipcRenderer: { on: () => () => {}, send: vi.fn(), invoke: vi.fn() },
    windowControl: {
      minimize: vi.fn(),
      maximize: vi.fn(),
      unmaximize: vi.fn(),
      toggleMaximize: vi.fn(),
      close: vi.fn(),
      isMaximized: vi.fn().mockResolvedValue(false),
      isFullScreen: vi.fn().mockResolvedValue(false),
      popupSubmenu: vi.fn()
    }
  }
})

import { useRibbonStore, extractBlockFromAffiliation } from '@/store/ribbon'
import { usePreferencesStore } from '@/store/preferences'
import { createSelectionFormatState } from '@/store/editor'
import FormatToolbar from '@/components/ribbon/formatToolbar.vue'
import bus from '@/bus'

describe('Ribbon Store & Block Detection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('extractBlockFromAffiliation', () => {
    it('detects mathblock from multiplemath affiliation', () => {
      expect(extractBlockFromAffiliation({ multiplemath: true })).toBe('mathblock')
    })

    it('detects table from table affiliation', () => {
      expect(extractBlockFromAffiliation({ table: true })).toBe('table')
    })

    it('detects code fence from fencecode or code', () => {
      expect(extractBlockFromAffiliation({ fencecode: true })).toBe('pre')
      expect(extractBlockFromAffiliation({ code: true })).toBe('pre')
      expect(extractBlockFromAffiliation({ 'code-block': true })).toBe('pre')
    })

    it('detects task list, ordered list, and bullet list', () => {
      expect(extractBlockFromAffiliation({ task: true, ul: true })).toBe('ul-task')
      expect(extractBlockFromAffiliation({ ol: true })).toBe('ol-order')
      expect(extractBlockFromAffiliation({ ul: true })).toBe('ul-bullet')
    })

    it('detects blockquote', () => {
      expect(extractBlockFromAffiliation({ blockquote: true })).toBe('blockquote')
    })

    it('detects headings h1 through h6', () => {
      for (let i = 1; i <= 6; i++) {
        expect(extractBlockFromAffiliation({ [`h${i}`]: true })).toBe(`heading ${i}`)
      }
    })

    it('defaults to paragraph when no block match is present', () => {
      expect(extractBlockFromAffiliation({})).toBe('paragraph')
      expect(extractBlockFromAffiliation({ p: true })).toBe('paragraph')
    })
  })

  describe('Ribbon state mutations and event dispatch', () => {
    it('tracks active inline formats and collapsed caret tokens', () => {
      const ribbonStore = useRibbonStore()
      expect(ribbonStore.activeFormats).toEqual({})

      const formats = createSelectionFormatState([
        { type: 'em' },
        { type: 'html_tag', tag: 'u' },
        { type: 'html_tag', tag: 'mark' }
      ])
      ribbonStore.setActiveFormats(formats)

      expect(ribbonStore.activeFormats.em).toBe(true)
      expect(ribbonStore.activeFormats.u).toBe(true)
      expect(ribbonStore.activeFormats.mark).toBe(true)
      expect(ribbonStore.activeFormats.strong).toBeUndefined()
    })

    it('updates activeBlock from affiliation correctly', () => {
      const ribbonStore = useRibbonStore()
      ribbonStore.updateFromAffiliation({ multiplemath: true })
      expect(ribbonStore.activeBlock).toBe('mathblock')

      ribbonStore.updateFromAffiliation({ h2: true })
      expect(ribbonStore.activeBlock).toBe('heading 2')
    })

    it('manages undo/redo state', () => {
      const ribbonStore = useRibbonStore()
      expect(ribbonStore.canUndo).toBe(true)
      expect(ribbonStore.canRedo).toBe(false)

      ribbonStore.setHistoryState(false, true)
      expect(ribbonStore.canUndo).toBe(false)
      expect(ribbonStore.canRedo).toBe(true)
    })

    it('emits format/paragraph on bus in WYSIWYG mode', () => {
      const ribbonStore = useRibbonStore()
      const preferencesStore = usePreferencesStore()
      preferencesStore.sourceCode = false

      const formatSpy = vi.fn()
      const paragraphSpy = vi.fn()
      const undoSpy = vi.fn()
      const redoSpy = vi.fn()

      bus.on('format', formatSpy)
      bus.on('paragraph', paragraphSpy)
      bus.on('undo', undoSpy)
      bus.on('redo', redoSpy)

      ribbonStore.applyFormat('strong')
      expect(formatSpy).toHaveBeenCalledWith('strong')

      ribbonStore.applyParagraph('heading 1')
      expect(paragraphSpy).toHaveBeenCalledWith('heading 1')

      ribbonStore.undo()
      expect(undoSpy).toHaveBeenCalled()

      ribbonStore.redo()
      expect(redoSpy).toHaveBeenCalled()

      bus.off('format', formatSpy)
      bus.off('paragraph', paragraphSpy)
      bus.off('undo', undoSpy)
      bus.off('redo', redoSpy)
    })

    it('emits source-format and source-paragraph on bus in Source Code Mode', () => {
      const ribbonStore = useRibbonStore()
      const preferencesStore = usePreferencesStore()
      preferencesStore.sourceCode = true

      const sourceFormatSpy = vi.fn()
      const sourceParagraphSpy = vi.fn()

      bus.on('source-format', sourceFormatSpy)
      bus.on('source-paragraph', sourceParagraphSpy)

      ribbonStore.applyFormat('inline_code')
      expect(sourceFormatSpy).toHaveBeenCalledWith('inline_code')

      ribbonStore.applyParagraph('mathblock')
      expect(sourceParagraphSpy).toHaveBeenCalledWith('mathblock')

      bus.off('source-format', sourceFormatSpy)
      bus.off('source-paragraph', sourceParagraphSpy)
    })
  })

  describe('Source Code delimiter wrapping simulation', () => {
    const wrapDelimiter = (text: string, open: string, close: string) => {
      if (text.startsWith(open) && text.endsWith(close)) {
        return text.slice(open.length, text.length - close.length)
      }
      return `${open}${text}${close}`
    }

    it('wraps text with bold markdown syntax and unwraps if already present', () => {
      const wrapped = wrapDelimiter('sample', '**', '**')
      expect(wrapped).toBe('**sample**')

      const unwrapped = wrapDelimiter(wrapped, '**', '**')
      expect(unwrapped).toBe('sample')
    })

    it('wraps text with italic, underline, mark, inline code, and math syntax', () => {
      expect(wrapDelimiter('sample', '*', '*')).toBe('*sample*')
      expect(wrapDelimiter('sample', '<u>', '</u>')).toBe('<u>sample</u>')
      expect(wrapDelimiter('sample', '~~', '~~')).toBe('~~sample~~')
      expect(wrapDelimiter('sample', '<mark>', '</mark>')).toBe('<mark>sample</mark>')
      expect(wrapDelimiter('sample', '`', '`')).toBe('`sample`')
      expect(wrapDelimiter('sample', '$', '$')).toBe('$sample$')
    })
  })

  describe('FormatToolbar Component (Wide vs Compact Responsive Overflow)', () => {
    let app: App | undefined

    afterEach(() => {
      app?.unmount()
      app = undefined
      document.body.innerHTML = ''
    })

    const mountToolbar = (isCompact = false) => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const root = document.createElement('div')
      document.body.append(root)

      app = createApp({
        setup: () => () => h(FormatToolbar, { isCompact })
      })
      app.use(pinia)
      app.use(ElementPlus)
      app.mount(root)

      return { root, ribbonStore: useRibbonStore() }
    }

    it('renders wide toolbar with full inline and block buttons when isCompact is false', () => {
      const { root } = mountToolbar(false)

      expect(root.querySelector('.heading-select-container')).not.toBeNull()
      expect(root.querySelector('.compact-categories')).toBeNull()

      const buttons = root.querySelectorAll<HTMLButtonElement>('.ribbon-btn')
      expect(buttons.length).toBeGreaterThanOrEqual(16)
    })

    it('displays compact text type labels (¶ for paragraph, H1..H6 for headings) and full labels in dropdown', async() => {
      const { root, ribbonStore } = mountToolbar(false)
      const headingButton = root.querySelector<HTMLButtonElement>('.heading-button')
      const labelSpan = root.querySelector('.heading-label')

      expect(labelSpan?.textContent?.trim()).toBe('¶')

      ribbonStore.activeBlock = 'heading 1'
      await nextTick()
      expect(labelSpan?.textContent?.trim()).toBe('H1')
      expect(headingButton?.classList.contains('is-active')).toBe(true)

      // Open dropdown
      headingButton?.click()
      await nextTick()

      const dropdown = root.querySelector('.heading-dropdown')
      expect(dropdown).not.toBeNull()
      expect(dropdown?.textContent).toContain('¶')
      expect(dropdown?.textContent).toContain('Paragraph')
      expect(dropdown?.textContent).toContain('H1')
      expect(dropdown?.textContent).toContain('Heading 1')
    })

    it('renders 3 compact categories (Text, Lists, Insert) without active badges when isCompact is true', () => {
      const { root } = mountToolbar(true)

      // Heading select remains visible
      expect(root.querySelector('.heading-select-container')).not.toBeNull()

      const categoryContainer = root.querySelector('.compact-categories')
      expect(categoryContainer).not.toBeNull()

      const categoryButtons = root.querySelectorAll<HTMLButtonElement>('.category-btn')
      expect(categoryButtons.length).toBe(3)

      const labels = Array.from(categoryButtons).map((btn) => btn.querySelector('.category-label')?.textContent?.trim())
      expect(labels).toEqual(['Text', 'Lists', 'Insert'])

      // Clean category buttons: none of them have is-active class
      categoryButtons.forEach((btn) => {
        expect(btn.classList.contains('is-active')).toBe(false)
      })
    })

    it('implements exclusive toggle behavior across Text, Lists, and Insert categories', async() => {
      const { root } = mountToolbar(true)
      const categoryButtons = root.querySelectorAll<HTMLButtonElement>('.category-btn')
      const [textBtn, listsBtn, insertBtn] = Array.from(categoryButtons)

      // Initially closed
      expect(root.querySelector('.category-dropdown')).toBeNull()

      // Click Text: opens Text dropdown
      textBtn.click()
      await nextTick()
      let dropdown = root.querySelector('.category-dropdown')
      expect(dropdown).not.toBeNull()
      expect(dropdown?.textContent).toContain('Bold')
      expect(dropdown?.textContent).toContain('Italic')

      // Click Lists: closes Text and opens Lists dropdown exclusively
      listsBtn.click()
      await nextTick()
      dropdown = root.querySelector('.category-dropdown')
      expect(dropdown).not.toBeNull()
      expect(dropdown?.textContent).toContain('Bullet List')
      expect(dropdown?.textContent).not.toContain('Bold')

      // Click Insert: closes Lists and opens Insert dropdown exclusively
      insertBtn.click()
      await nextTick()
      dropdown = root.querySelector('.category-dropdown')
      expect(dropdown).not.toBeNull()
      expect(dropdown?.textContent).toContain('Math Block')
      expect(dropdown?.textContent).toContain('Quote Block')
      expect(dropdown?.textContent).not.toContain('Bullet List')

      // Clicking open container again closes it
      insertBtn.click()
      await nextTick()
      expect(root.querySelector('.category-dropdown')).toBeNull()
    })

    it('highlights active formats and blocks inside category dropdowns', async() => {
      const { root, ribbonStore } = mountToolbar(true)
      ribbonStore.setActiveFormats({ strong: true })
      ribbonStore.activeBlock = 'mathblock'

      const categoryButtons = root.querySelectorAll<HTMLButtonElement>('.category-btn')
      const [textBtn, , insertBtn] = Array.from(categoryButtons)

      // Open Text: Bold should have is-active class
      textBtn.click()
      await nextTick()
      const boldItem = Array.from(root.querySelectorAll<HTMLButtonElement>('.dropdown-item'))
        .find((item) => item.textContent?.includes('Bold'))
      expect(boldItem?.classList.contains('is-active')).toBe(true)

      const italicItem = Array.from(root.querySelectorAll<HTMLButtonElement>('.dropdown-item'))
        .find((item) => item.textContent?.includes('Italic'))
      expect(italicItem?.classList.contains('is-active')).toBe(false)

      // Open Insert: Math Block should have is-active class
      insertBtn.click()
      await nextTick()
      const mathBlockItem = Array.from(root.querySelectorAll<HTMLButtonElement>('.dropdown-item'))
        .find((item) => item.textContent?.includes('Math Block'))
      expect(mathBlockItem?.classList.contains('is-active')).toBe(true)
    })

    it('executes formatting actions from dropdown items and closes the container', async() => {
      const { root, ribbonStore } = mountToolbar(true)
      const applyFormatSpy = vi.spyOn(ribbonStore, 'applyFormat')
      const categoryButtons = root.querySelectorAll<HTMLButtonElement>('.category-btn')
      const [textBtn] = Array.from(categoryButtons)

      textBtn.click()
      await nextTick()
      expect(root.querySelector('.category-dropdown')).not.toBeNull()

      const boldItem = Array.from(root.querySelectorAll<HTMLButtonElement>('.dropdown-item'))
        .find((item) => item.textContent?.includes('Bold'))
      boldItem?.click()
      await nextTick()

      expect(applyFormatSpy).toHaveBeenCalledWith('strong')
      expect(root.querySelector('.category-dropdown')).toBeNull()
    })
  })
})
