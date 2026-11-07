<template>
  <div
    ref="sourceCodeContainer"
    class="source-code"
    @scroll.passive="handleScroll"
  />
</template>

<script setup lang="ts">
import {
  registerSourceView,
  captureSourceHistory,
  restoreSourceHistory
} from '../../services/documentMode'
import { ref, shallowRef, markRaw, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useEditorStore } from '@/store/editor'
import { usePreferencesStore } from '@/store/preferences'
import { useRibbonStore } from '@/store/ribbon'

import { registerSourceViewState, documentViewChanged } from '@/services/documentViewState'
import {
  findMarkdownHeadingLine,
  getMarkdownHeadingLines,
  scrollSourceEditorToLine
} from '@/util/sourceModeToc'
import { storeToRefs } from 'pinia'
import type CodeMirror from 'codemirror'
import codeMirror, { setCursorAtFirstLine, setTextDirection } from '../../codeMirror'
import { wordCount as getWordCount } from '@muyajs/core'
import { adjustCursor, isWindows } from '../../util'
import { getSourceExtraKeys } from '../../codeMirror/keybindings'
import bus from '../../bus'
import { oneDarkThemes, railscastsThemes } from '@/config'

interface MuyaIndexCursorLike {
  anchor: CodeMirror.Position
  focus: CodeMirror.Position
}

const props = defineProps<{
  markdown?: string
  muyaIndexCursor?: unknown
  textDirection: string
}>()

const editorStore = useEditorStore()
const preferencesStore = usePreferencesStore()

const sourceCodeContainer = ref<HTMLDivElement | null>(null)

const editor = shallowRef<CodeMirror.Editor | null>(null)
const viewDestroyed = ref(false)
const tabId = ref<string | null>(null)
let resizeObserver: ResizeObserver | undefined
let releaseViewState: (() => void) | undefined

const {
  theme,
  sourceCode,
  sourceCodeLineNumbers,
  texMathDollars,
  texMathGfm,
  texMathSingleBackslash,
  texMathDoubleBackslash
} = storeToRefs(preferencesStore)
const { currentFile: currentTab } = storeToRefs(editorStore)

const isValidMuyaIndexCursor = (cursor: unknown): cursor is MuyaIndexCursorLike => {
  const c = cursor as MuyaIndexCursorLike | null | undefined
  return !!(c && c.anchor && c.focus)
}

watch(
  () => props.textDirection,
  (value, oldValue) => {
    if (value !== oldValue && editor.value) {
      setTextDirection(editor.value, value)
    }
  }
)

watch(sourceCodeLineNumbers, (value) => {
  editor.value?.setOption('lineNumbers', value)
})

// A fresh instance reads these at mount; the watch is for a preference changed
// while the source view is already open (#5446).
const markdownMathMode = () => ({
  name: 'markdown-math',
  texMathDollars: texMathDollars.value,
  texMathGfm: texMathGfm.value,
  texMathSingleBackslash: texMathSingleBackslash.value,
  texMathDoubleBackslash: texMathDoubleBackslash.value
})

watch([texMathDollars, texMathGfm, texMathSingleBackslash, texMathDoubleBackslash], () => {
  editor.value?.setOption('mode', markdownMathMode())
})

const getMarkdownAndCursor = (cm: CodeMirror.Editor) => {
  let focus = cm.getCursor('head')
  let anchor = cm.getCursor('anchor')

  const markdown: string = cm.getValue()
  const convertToMuyaCursor = (cursor: CodeMirror.Position) => {
    const line = cm.getLine(cursor.line)
    const preLine = cm.getLine(cursor.line - 1)
    const nextLine = cm.getLine(cursor.line + 1)
    return adjustCursor(
      cursor,
      preLine,
      line,
      nextLine,
      (lineNumber) => {
        return cm.getLine(lineNumber)
      },
      cm.lineCount()
    )
  }

  anchor = convertToMuyaCursor(anchor)
  focus = convertToMuyaCursor(focus)

  // Normalize cursor that `anchor` is always before `focus` because
  // this is the expected behavior in Muya.
  if (anchor && focus && anchor.line > focus.line) {
    const tmpCursor = focus
    focus = anchor
    anchor = tmpCursor
  }
  return { cursor: { focus, anchor }, markdown }
}

const prepareTabSwitch = () => {
  if (tabId.value && editor.value) {
    const { cursor, markdown: newMarkdown } = getMarkdownAndCursor(editor.value)
    editorStore.LISTEN_FOR_CONTENT_CHANGE({
      id: tabId.value,
      markdown: newMarkdown,
      muyaIndexCursor: cursor
    })
    captureSourceHistory(
      tabId.value,
      editor.value,
      editorStore.tabs.find((tab) => tab.id === tabId.value)?.markdown
    )
    tabId.value = null
  }
}

interface FileChangePayloadLike {
  reason?: string
  id: string
  markdown?: string
  muyaIndexCursor?: unknown
}

const handleFileChange = (payload: unknown) => {
  const { id, markdown: newMarkdown, muyaIndexCursor, reason } = payload as FileChangePayloadLike
  if (reason === 'source-handoff') return
  if (!editor.value) return

  // On same-tab reload (external file change), preserve scroll across
  // setValue. Snapshot every plausible scroll element (the outer
  // .source-code div, CodeMirror's own scroller, and the nearest scrollable
  // ancestor) and restore each, since which one is actually active depends
  // on CodeMirror's height:auto + outer overflow:auto interplay. Re-apply
  // on nextTick and the next animation frame to outlast layout side-effects
  // from sibling handlers: muya editor.vue also listens for file-changed.
  // A cross-tab switch must instead commit the outgoing tab's state; the
  // fresh markdown from disk would otherwise overwrite uncommitted edits.
  const isSameTabReload = tabId.value && tabId.value === id
  const scrollTargets: Array<{ el: HTMLElement; top: number }> = []
  if (isSameTabReload) {
    const seen = new Set<HTMLElement>()
    const consider = (el: HTMLElement | null | undefined) => {
      if (el && !seen.has(el)) {
        seen.add(el)
        scrollTargets.push({ el, top: el.scrollTop })
      }
    }
    consider(sourceCodeContainer.value)
    consider(editor.value.getScrollerElement?.() as HTMLElement | null | undefined)
    let node: HTMLElement | null = sourceCodeContainer.value?.parentElement ?? null
    while (node && node !== document.body) {
      const overflowY = window.getComputedStyle(node).overflowY
      if (
        (overflowY === 'auto' || overflowY === 'scroll') &&
        node.scrollHeight > node.clientHeight
      ) {
        consider(node)
        break
      }
      node = node.parentElement
    }
  } else {
    prepareTabSwitch()
    tabId.value = id
  }

  if (typeof newMarkdown === 'string' && editor.value.getValue() !== newMarkdown) {
    editor.value.setValue(newMarkdown)
  }
  if (!isSameTabReload) restoreSourceHistory(id, editor.value)

  if (isValidMuyaIndexCursor(muyaIndexCursor)) {
    const { anchor, focus } = muyaIndexCursor

    editor.value.setSelection(anchor, focus, { scroll: true })
  } else if (scrollTargets.length) {
    const restoreScroll = () => {
      for (const { el, top } of scrollTargets) el.scrollTop = top
    }
    restoreScroll()
    nextTick(restoreScroll)
    requestAnimationFrame(restoreScroll)
  } else {
    setCursorAtFirstLine(editor.value)
  }
}

const handleSelectAll = () => {
  if (!sourceCode.value) {
    return
  }

  if (editor.value && editor.value.hasFocus()) {
    editor.value.execCommand('selectAll')
  } else {
    const activeElement = document.activeElement as HTMLElement | null
    const nodeName = activeElement?.nodeName
    if (nodeName === 'INPUT' || nodeName === 'TEXTAREA') {
      const selectable = activeElement as HTMLInputElement | HTMLTextAreaElement | null
      if (selectable && typeof selectable.select === 'function') {
        selectable.select()
      }
    }
  }
}

const handleUndo = () => {
  if (!sourceCode.value) {
    return
  }

  if (editor.value) {
    editor.value.execCommand('undo')
  }
}

const handleRedo = () => {
  if (!sourceCode.value) {
    return
  }

  if (editor.value) {
    editor.value.execCommand('redo')
  }
}

interface ImageActionPayload {
  id: string
  result: string
  alt: string
}

const handleImageAction = (payload: unknown) => {
  const cm = editor.value
  if (!cm) return

  const { id, result, alt } = payload as ImageActionPayload
  const value: string = cm.getValue()
  const focus = cm.getCursor('focus')
  const anchor = cm.getCursor('anchor')
  const lines: string[] = value.split('\n')
  const index = lines.findIndex((line: string) => line.indexOf(id) > 0)

  if (index > -1) {
    const oldLine = lines[index]
    lines[index] = oldLine.replace(new RegExp(`!\\[${id}\\]\\(.*\\)`), `![${alt}](${result})`)
    const newValue = lines.join('\n')
    cm.setValue(newValue)
    const match = /(!\[.*\]\(.*\))/.exec(oldLine)
    if (!match) {
      return
    }
    const range = {
      start: match.index,
      end: match.index + match[1].length
    }
    const delta = alt.length + result.length + 5 - match[1].length

    const adjustPointer = (pointer: CodeMirror.Position) => {
      if (!pointer) {
        return
      }
      if (pointer.line !== index) {
        return
      }
      if (pointer.ch <= range.start) {
        // do nothing.
      } else if (pointer.ch > range.start && pointer.ch < range.end) {
        pointer.ch = range.start + alt.length + result.length + 5
      } else {
        pointer.ch += delta
      }
    }

    adjustPointer(focus)
    adjustPointer(anchor)
    if (focus && anchor) {
      cm.setSelection(anchor, focus, { scroll: true })
    } else {
      setCursorAtFirstLine(cm)
    }
  }
}

// `cursorActivity` fires per drag step, so key the dedup on the ranges rather
// than on `getSelection()`, which copies the whole selection.
let lastSelectionKey = ''

const selectionKey = (cm: CodeMirror.Editor): string =>
  cm
    .listSelections()
    .map(({ anchor, head }) => `${anchor.line}:${anchor.ch}-${head.line}:${head.ch}`)
    .join(',')

const updateSelectionWordCount = (cm: CodeMirror.Editor) => {
  const key = selectionKey(cm)
  if (key === lastSelectionKey && editorStore.selectionWordCount != null) return
  lastSelectionKey = key

  const selectedText = cm.getSelection()
  const hasSelection = selectedText.trim().length > 0
  if (!hasSelection && editorStore.selectionWordCount == null) return

  editorStore.SET_SELECTION_WORD_COUNT(hasSelection ? getWordCount(selectedText) : null)
}

const saveContent = (cm: CodeMirror.Editor) => {
  const { cursor, markdown: newMarkdown } = getMarkdownAndCursor(cm)
  const wordCount = getWordCount(newMarkdown)
  if (!viewDestroyed.value) {
    if (tabId.value) {
      editorStore.LISTEN_FOR_CONTENT_CHANGE({
        id: tabId.value,
        markdown: newMarkdown,
        wordCount,
        muyaIndexCursor: cursor
      })
    } else {
      // This may occur during tab switching but should not occur otherwise.
      console.warn('LISTEN_FOR_CONTENT_CHANGE: Cannot commit changes because not tab id was set!')
    }
  }
}

let headingMarkdown = ''
let headingLines: number[] = []

const setActiveHeadingAtLine = (line: number): void => {
  if (!editor.value) return
  const markdown = editor.value.getValue()
  if (markdown !== headingMarkdown) {
    headingMarkdown = markdown
    headingLines = getMarkdownHeadingLines(markdown)
  }
  let slug: string | null = null
  for (let index = 0; index < editorStore.listToc.length; index++) {
    const headingLine = headingLines[index] ?? -1
    if (headingLine < 0 || headingLine > line) break
    slug = editorStore.listToc[index].slug ?? null
  }
  editorStore.SET_ACTIVE_HEADING(slug)
}

const updateActiveHeadingFromScroll = (): void => {
  const container = sourceCodeContainer.value
  if (!container || !editor.value) return
  const top = container.getBoundingClientRect().top + 80
  const line = editor.value.lineAtHeight(top, 'window')
  setActiveHeadingAtLine(line)
}

const handleScroll = (): void => {
  updateActiveHeadingFromScroll()
  documentViewChanged()
}

const updateRibbonStateFromCodeMirror = (cm: CodeMirror.Editor) => {
  const ribbonStore = useRibbonStore()
  const historySize = cm.historySize()
  ribbonStore.setHistoryState(historySize.undo > 0, historySize.redo > 0)

  const doc = cm.getDoc()
  const cursor = doc.getCursor('head')
  const lineContent = doc.getLine(cursor.line) || ''

  let block = 'paragraph'
  if (/^#{1,6}\s/.test(lineContent)) {
    const match = lineContent.match(/^(#{1,6})\s/)
    if (match) {
      block = `heading ${match[1].length}`
    }
  } else if (/^>\s?/.test(lineContent)) {
    block = 'blockquote'
  } else if (/^-\s\[[ xX]\]\s/.test(lineContent)) {
    block = 'ul-task'
  } else if (/^[-*+]\s/.test(lineContent)) {
    block = 'ul-bullet'
  } else if (/^\d+\.\s/.test(lineContent)) {
    block = 'ol-order'
  } else if (/^\|.+\|/.test(lineContent)) {
    block = 'table'
  } else if (/^```/.test(lineContent)) {
    block = 'pre'
  } else if (/^\$\$/.test(lineContent)) {
    block = 'mathblock'
  } else {
    let inMath = false
    let inFence = false
    for (let i = 0; i <= cursor.line; i++) {
      const l = doc.getLine(i)
      if (l.trim().startsWith('$$')) inMath = !inMath
      if (l.trim().startsWith('```')) inFence = !inFence
    }
    if (inMath) block = 'mathblock'
    else if (inFence) block = 'pre'
  }
  ribbonStore.setActiveBlock(block)

  const formats: Record<string, boolean> = {}
  const selectedText = doc.getSelection()

  const checkInlineFormat = (regex: RegExp, key: string) => {
    if (selectedText && regex.test(selectedText)) {
      formats[key] = true
    }
    const ch = cursor.ch
    let match: RegExpExecArray | null
    const globalRegex = new RegExp(regex.source, 'g')
    while ((match = globalRegex.exec(lineContent)) !== null) {
      if (ch >= match.index && ch <= match.index + match[0].length) {
        formats[key] = true
        break
      }
    }
  }

  checkInlineFormat(/\*\*[^*]+\*\*/, 'strong')
  checkInlineFormat(/(?:^|[^*])\*[^*]+\*(?:[^*]|$)/, 'em')
  checkInlineFormat(/<u>.*?<\/u>/, 'u')
  checkInlineFormat(/~~.*?~~/, 'del')
  checkInlineFormat(/<mark>.*?<\/mark>/, 'mark')
  checkInlineFormat(/`[^`]+`/, 'inline_code')
  checkInlineFormat(/\$[^$]+\$/, 'inline_math')
  checkInlineFormat(/\[.*?\]\(.*?\)/, 'link')

  ribbonStore.setActiveFormats(formats)
}

const handleSourceFormat = (type: unknown) => {
  if (!editor.value || typeof type !== 'string') return
  const doc = editor.value.getDoc()
  const selection = doc.getSelection()
  const from = doc.getCursor('from')
  const to = doc.getCursor('to')

  interface Delimiter {
    open: string
    close: string
  }
  const formatDelimiters: Record<string, Delimiter> = {
    strong: { open: '**', close: '**' },
    em: { open: '*', close: '*' },
    u: { open: '<u>', close: '</u>' },
    del: { open: '~~', close: '~~' },
    mark: { open: '<mark>', close: '</mark>' },
    inline_code: { open: '`', close: '`' },
    inline_math: { open: '$', close: '$' },
    link: { open: '[', close: '](url)' },
    image: { open: '![', close: '](url)' }
  }

  const delim = formatDelimiters[type]
  if (!delim) return

  if (selection.length > 0) {
    if (selection.startsWith(delim.open) && selection.endsWith(delim.close)) {
      const unwrapped = selection.slice(delim.open.length, selection.length - delim.close.length)
      doc.replaceRange(unwrapped, from, to)
    } else {
      doc.replaceRange(`${delim.open}${selection}${delim.close}`, from, to)
    }
  } else {
    doc.replaceRange(`${delim.open}${delim.close}`, from)
    doc.setCursor({ line: from.line, ch: from.ch + delim.open.length })
  }
  editor.value.focus()
  saveContent(editor.value)
  updateRibbonStateFromCodeMirror(editor.value)
}

const handleSourceParagraph = (type: unknown) => {
  if (!editor.value || typeof type !== 'string') return
  const doc = editor.value.getDoc()
  const cursor = doc.getCursor('head')
  const line = cursor.line
  const lineContent = doc.getLine(line)

  if (type.startsWith('heading ')) {
    const level = parseInt(type.replace('heading ', ''), 10)
    const hashes = '#'.repeat(level) + ' '
    const stripped = lineContent.replace(/^#{1,6}\s*/, '')
    doc.replaceRange(hashes + stripped, { line, ch: 0 }, { line, ch: lineContent.length })
  } else if (type === 'paragraph') {
    const stripped = lineContent.replace(/^(#{1,6}\s*|>\s*|[-*+]\s*(\[[ xX]\]\s*)?|\d+\.\s*)/, '')
    doc.replaceRange(stripped, { line, ch: 0 }, { line, ch: lineContent.length })
  } else if (type === 'blockquote') {
    if (lineContent.startsWith('> ')) {
      doc.replaceRange(lineContent.slice(2), { line, ch: 0 }, { line, ch: lineContent.length })
    } else {
      doc.replaceRange('> ' + lineContent, { line, ch: 0 }, { line, ch: lineContent.length })
    }
  } else if (type === 'ul-bullet') {
    if (/^[-*+]\s/.test(lineContent)) {
      doc.replaceRange(lineContent.replace(/^[-*+]\s/, ''), { line, ch: 0 }, { line, ch: lineContent.length })
    } else {
      doc.replaceRange('- ' + lineContent, { line, ch: 0 }, { line, ch: lineContent.length })
    }
  } else if (type === 'ol-order') {
    if (/^\d+\.\s/.test(lineContent)) {
      doc.replaceRange(lineContent.replace(/^\d+\.\s/, ''), { line, ch: 0 }, { line, ch: lineContent.length })
    } else {
      doc.replaceRange('1. ' + lineContent, { line, ch: 0 }, { line, ch: lineContent.length })
    }
  } else if (type === 'ul-task') {
    if (/^-\s\[[ xX]\]\s/.test(lineContent)) {
      doc.replaceRange(lineContent.replace(/^-\s\[[ xX]\]\s/, ''), { line, ch: 0 }, { line, ch: lineContent.length })
    } else {
      doc.replaceRange('- [ ] ' + lineContent, { line, ch: 0 }, { line, ch: lineContent.length })
    }
  } else if (type === 'mathblock') {
    doc.replaceRange('\n$$\n\n$$\n', cursor)
    doc.setCursor({ line: cursor.line + 2, ch: 0 })
  } else if (type === 'pre') {
    doc.replaceRange('\n```\n\n```\n', cursor)
    doc.setCursor({ line: cursor.line + 2, ch: 0 })
  } else if (type === 'table') {
    const tableTemplate = '\n| Header 1 | Header 2 | Header 3 |\n| --- | --- | --- |\n| Cell 1 | Cell 2 | Cell 3 |\n'
    doc.replaceRange(tableTemplate, cursor)
  } else if (type === 'hr') {
    doc.replaceRange('\n---\n', cursor)
  }

  editor.value.focus()
  saveContent(editor.value)
  updateRibbonStateFromCodeMirror(editor.value)
}

const listenChange = (cm: CodeMirror.Editor) => {
  cm.on('cursorActivity', (instance: CodeMirror.Editor) => {
    saveContent(instance)
    updateSelectionWordCount(instance)
    setActiveHeadingAtLine(instance.getCursor().line)
    updateRibbonStateFromCodeMirror(instance)
  })
}

// #3580: in Source Code mode the WYSIWYG container is hidden, so the
// `scroll-to-header` bus event (emitted when a TOC entry is clicked) must scroll
// CodeMirror instead. Resolve the TOC entry to its heading line in the source.
const handleScrollToHeader = (slug: unknown) => {
  if (!editor.value) return
  const index = editorStore.listToc.findIndex((item) => item.slug === slug)
  if (index < 0) return
  const line = findMarkdownHeadingLine(editor.value.getValue(), index)
  if (line < 0) return
  // `.source-code` is the scroll container (CodeMirror renders full-height with
  // viewportMargin: Infinity, so its own scroller never scrolls).
  scrollSourceEditorToLine(editor.value, line, sourceCodeContainer.value)
}

onMounted(() => {
  if (!currentTab.value) return
  const { id } = currentTab.value
  // Reset WYSIWYG scroll, block and cursor state; source mode uses different coordinates.
  currentTab.value.scrollTop = 0
  currentTab.value.blocks = undefined
  currentTab.value.cursor = undefined

  const { markdown, muyaIndexCursor, textDirection } = props
  const container = sourceCodeContainer.value
  if (!container) return
  const codeMirrorConfig: Record<string, unknown> = {
    value: markdown,
    lineNumbers: sourceCodeLineNumbers.value,
    autofocus: true,
    lineWrapping: true,
    styleActiveLine: true,
    extraKeys: getSourceExtraKeys(isWindows),
    direction: textDirection,
    viewportMargin: Infinity
  }

  if (railscastsThemes.includes(theme.value)) {
    codeMirrorConfig.theme = 'railscasts'
  } else if (oneDarkThemes.includes(theme.value)) {
    codeMirrorConfig.theme = 'one-dark'
  }

  bus.on('file-loaded', handleFileChange)
  bus.on('file-changed', handleFileChange)
  bus.on('selectAll', handleSelectAll)
  bus.on('undo', handleUndo)
  bus.on('redo', handleRedo)
  bus.on('source-format', handleSourceFormat)
  bus.on('source-paragraph', handleSourceParagraph)
  bus.on('image-action', handleImageAction)
  bus.on('scroll-to-header', handleScrollToHeader)

  // CodeMirror's line tree relies on object identity and must not be proxied by Vue.
  const codeMirrorInstance = markRaw(codeMirror(container, codeMirrorConfig))

  codeMirrorInstance.setOption('mode', markdownMathMode())

  codeMirrorInstance.on('contextmenu', (_cm: CodeMirror.Editor, event: Event) => {
    event.preventDefault()
    event.stopPropagation()
  })

  if (isValidMuyaIndexCursor(muyaIndexCursor)) {
    const { anchor, focus } = muyaIndexCursor
    codeMirrorInstance.setSelection(anchor, focus, { scroll: true })
  } else {
    setCursorAtFirstLine(codeMirrorInstance)
  }

  restoreSourceHistory(id, codeMirrorInstance)
  editor.value = codeMirrorInstance
  tabId.value = id
  updateSelectionWordCount(codeMirrorInstance)
  updateRibbonStateFromCodeMirror(codeMirrorInstance)

  // Pane resizing rewraps lines without triggering CodeMirror's window-resize listener.
  let measuredWidth = 0
  resizeObserver = new ResizeObserver(([entry]) => {
    const width = entry.contentRect.width
    if (width <= 0 || width === measuredWidth) return
    measuredWidth = width
    codeMirrorInstance.refresh()
    updateActiveHeadingFromScroll()
  })
  resizeObserver.observe(codeMirrorInstance.getWrapperElement())

  releaseViewState = registerSourceViewState({
    documentId: () => tabId.value,
    view: { editor: codeMirrorInstance, container }
  })
  codeMirrorInstance.on('cursorActivity', documentViewChanged)
  listenChange(codeMirrorInstance)
  registerSourceView(async () => {
    if (editor.value) saveContent(editor.value)
  })
})

onBeforeUnmount(() => {
  releaseViewState?.()
  editor.value?.off('cursorActivity', documentViewChanged)
  resizeObserver?.disconnect()
  registerSourceView(null)
  if (editor.value) {
    saveContent(editor.value)
    captureSourceHistory(
      tabId.value,
      editor.value,
      editorStore.tabs.find((tab) => tab.id === tabId.value)?.markdown
    )
  }
  viewDestroyed.value = true

  bus.off('file-loaded', handleFileChange)
  bus.off('file-changed', handleFileChange)
  bus.off('selectAll', handleSelectAll)
  bus.off('undo', handleUndo)
  bus.off('redo', handleRedo)
  bus.off('source-format', handleSourceFormat)
  bus.off('source-paragraph', handleSourceParagraph)
  bus.off('image-action', handleImageAction)
  editorStore.SET_SELECTION_WORD_COUNT(null)
  lastSelectionKey = ''
  bus.off('scroll-to-header', handleScrollToHeader)

  if (editor.value) {
    const { cursor, markdown: newMarkdown } = getMarkdownAndCursor(editor.value)
    bus.emit('file-changed', {
      reason: 'source-handoff',
      id: tabId.value,
      markdown: newMarkdown,
      muyaIndexCursor: cursor,
      renderCursor: true
    })
  }
})
</script>

<style>
.source-code {
  height: 100%;
  box-sizing: border-box;
  overflow: auto;
}
.source-code .CodeMirror {
  height: auto;
  margin: 50px auto;
  max-width: var(--editorAreaWidth);
  background: transparent;
}
.source-code .CodeMirror-gutters {
  border-right: none;
  background-color: transparent;
}
.source-code .CodeMirror-activeline-background,
.source-code .CodeMirror-activeline-gutter {
  background: var(--floatHoverColor);
}
/* Fade the delimiters against the formula. Dimming the inherited colour rather
   than naming one is what carries across every theme; 0.65 is the lowest value
   still clearing 3:1 in all of them, with one-dark at 3.67 setting the floor. */
.source-code .CodeMirror .cm-formatting-math {
  opacity: 0.65;
}
</style>
