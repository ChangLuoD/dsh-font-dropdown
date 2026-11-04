/**
 * DeepSeek Harness (dsh) plugin: dsh-font-dropdown - browser half.
 *
 * Adds a "字体" cell to Settings -> General with three dropdowns (text, code,
 * terminal) listing the fonts installed on this machine, and hides the shipped
 * free-text font-family inputs so the dropdowns are the only way to choose.
 *
 * Writes go through the client theme service (`setFontFamily(role, value)`),
 * which owns the same settings scope the shipped inputs use.
 */
window.__ModuleLoader__.load({
  id: 'dsh-font-dropdown',
  factory(require) {
    const React = (typeof window !== 'undefined' && window.React) || require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState } = React

    const LOCALE_NS = 'font-dropdown'
    const FONTS_ROUTE = '/plugins/font-dropdown/fonts'

    /** Shown immediately, replaced by the Host answer as soon as it arrives. */
    const FALLBACK_FONTS = [
      'Arial', 'Arial Black', 'Bahnschrift', 'Calibri', 'Calibri Light', 'Cambria',
      'Cambria Math', 'Candara', 'Candara Light', 'Cascadia Code', 'Cascadia Mono',
      'Comic Sans MS', 'Consolas', 'Constantia', 'Corbel', 'Corbel Light',
      'Courier New', 'DejaVu Math TeX Gyre', 'Ebrima', 'Franklin Gothic Medium',
      'Gabriola', 'Gadugi', 'Georgia', 'HarmonyOS Sans Black', 'HarmonyOS Sans Medium',
      'HarmonyOS Sans Thin', 'Impact', 'Ink Free', 'Javanese Text', 'JetBrains Mono Medium',
      'Leelawadee UI', 'Lucida Console', 'Lucida Sans Unicode', 'Malgun Gothic',
      'Marlett', 'Microsoft Himalaya', 'Microsoft JhengHei UI', 'Microsoft New Tai Lue',
      'Microsoft PhagsPa', 'Microsoft Sans Serif', 'Microsoft Tai Le',
      'Microsoft YaHei UI', 'Microsoft Yi Baiti', 'Mongolian Baiti', 'MS Gothic',
      'MS PGothic', 'MS UI Gothic', 'MV Boli', 'Myanmar Text', 'Nirmala Text',
      'Nirmala UI', 'Noto Sans SC', 'Noto Serif SC', 'Palatino Linotype',
      'Sans Serif Collection', 'Segoe Fluent Icons', 'Segoe MDL2 Assets', 'Segoe Print',
      'Segoe Script', 'Segoe UI', 'Segoe UI Black', 'Segoe UI Emoji', 'Segoe UI Light',
      'Segoe UI Semibold', 'Segoe UI Semilight', 'Segoe UI Symbol', 'Sitka Banner',
      'Sitka Display', 'Sitka Heading', 'Sitka Small', 'Sitka Subheading', 'Sitka Text',
      'Sylfaen', 'Symbol', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Unifont Smooth',
      'Verdana', 'Webdings', 'Wingdings', 'Yu Gothic', 'Yu Gothic UI',
      '阿里巴巴普惠体 3.0 75 SemiBold', '阿里妈妈数黑体', '等线', '等线 Light',
      '钉钉进步体', '仿宋', '凤凰点阵体 12px', '凤凰点阵体 16px', '黑体', '楷体',
      '宋体', '微软雅黑', '微软雅黑 Light', '微軟正黑體', '新宋体',
    ]

    const ZH = {
      'text.title': '正文字体',
      'text.description': '用于界面与会话正文。下拉选择本机已安装字体，留空使用默认字体。',
      'code.title': '代码字体',
      'code.description': '用于代码块、行内代码与工具输出。',
      'terminal.title': '终端字体',
      'terminal.description': '用于侧栏终端。',
      'default': '默认字体',
      'search': '搜索字体',
      'empty': '没有匹配的字体',
      'fallback': '未能读取系统字体列表，暂显示内置常用字体。',
    }

    const EN = {
      'text.title': 'Text font',
      'text.description': 'Used for the interface and conversation text. Pick an installed font; leave empty for the default.',
      'code.title': 'Code font',
      'code.description': 'Used for code blocks, inline code and tool output.',
      'terminal.title': 'Terminal font',
      'terminal.description': 'Used for the sidebar terminal.',
      'default': 'Default font',
      'search': 'Search fonts',
      'empty': 'No matching fonts',
      'fallback': 'Could not read the installed fonts; showing a built-in list instead.',
    }

    const ROLE_DEFS = [
      { role: 'text', title: 'text.title', description: 'text.description' },
      { role: 'code', title: 'code.title', description: 'code.description' },
      { role: 'terminal', title: 'terminal.title', description: 'terminal.description' },
    ]

    const CSS = `
.dshfp-cell{display:flex;flex-direction:column;margin:0}
.dshfp-row{display:flex;align-items:center;gap:8px;padding:16px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.dshfp-row:last-child{border-bottom:none}
.dshfp-text{flex:1;min-width:0;padding-right:48px}
.dshfp-title{font-size:14px;font-weight:400;line-height:22px;color:var(--dsw-alias-label-primary)}
.dshfp-desc{margin-top:4px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.dshfp-control{flex:none;display:inline-flex;align-items:center}
/* Trigger pill copied from the shipped Language row selector
   (padding 0 14px, radius-md, module-platform fill, no border). */
.dshfp-trigger{
  box-sizing:border-box;width:240px;height:36px;padding:0 14px;
  display:inline-flex;align-items:center;justify-content:space-between;gap:12px;
  border:none;border-radius:var(--dsw-radius-md);
  background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary);
  font:inherit;font-size:14px;line-height:22px;text-align:left;cursor:pointer;outline:none;
}
.dshfp-trigger:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dshfp-trigger:focus-visible{box-shadow:0 0 0 1.5px var(--dsw-alias-border-l2)}
.dshfp-triggerText{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dshfp-chevron{flex:none;width:12px;height:12px;color:var(--dsw-alias-label-secondary)}
.dshfp-menu{
  position:fixed;z-index:2147483000;box-sizing:border-box;width:240px;max-height:352px;
  display:flex;flex-direction:column;padding:4px;isolation:isolate;
  border:0;border-radius:var(--dsw-radius-lg);
  background:var(--dsw-specific-menu, var(--dsw-alias-bg-layer-1));
  -webkit-backdrop-filter:var(--dsw-menu-backdrop-filter, blur(40px) saturate(150%));
  backdrop-filter:var(--dsw-menu-backdrop-filter, blur(40px) saturate(150%));
  box-shadow:var(--dsw-elevation-prominent, 0 0 0 .5px var(--dsw-alias-border-l1), 0 12px 32px rgba(0,0,0,.3));
}
.dshfp-search{
  box-sizing:border-box;height:32px;margin:0 0 4px;padding:0 8px;
  border:0;border-bottom:.5px solid var(--dsw-alias-border-l2);border-radius:0;
  background:transparent;color:var(--dsw-alias-label-primary);
  font:inherit;font-size:13px;line-height:20px;outline:none;
}
.dshfp-search::placeholder{color:var(--dsw-alias-label-tertiary)}
.dshfp-search::-webkit-search-cancel-button{display:none}
.dshfp-list{overflow-y:auto;overscroll-behavior:contain;flex:1;min-height:0}
.dshfp-item{
  display:flex;align-items:center;gap:6px;min-height:34px;padding:6px 8px;
  border-radius:var(--dsw-radius-md);color:var(--dsw-alias-label-primary);
  font-size:13px;line-height:20px;white-space:nowrap;cursor:pointer;
}
.dshfp-item[data-active="true"]{background:var(--dsw-alias-interactive-bg-hover)}
.dshfp-itemName{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}
.dshfp-itemCheck{flex:none;color:var(--dsw-alias-label-primary);font-size:13px;line-height:1}
.dshfp-itemDefault{color:var(--dsw-alias-label-secondary)}
.dshfp-empty{padding:6px 8px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary)}
/* Hide the shipped free-text font-family rows: the dropdowns above replace them.
   Scoped to the shipped row class on purpose — if a future build renames it the
   rows stay visible (a duplicate input) instead of an ancestor being hidden. */
[class*="_row"]:has(input[aria-label="正文字体"]),
[class*="_row"]:has(input[aria-label="代码字体"]),
[class*="_row"]:has(input[aria-label="终端字体"]),
[class*="_row"]:has(input[aria-label="Text font"]),
[class*="_row"]:has(input[aria-label="Code font"]),
[class*="_row"]:has(input[aria-label="Terminal font"]){display:none!important}
.dshfp-hint{margin-top:2px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
`

    /** Runtime handles captured in apply(), read by the component. */
    const runtime = { theme: null }

    /** Current theme snapshot shared with React. */
    const snapshotStore = {
      value: null,
      listeners: new Set(),
      get() {
        return snapshotStore.value
      },
      set(next) {
        snapshotStore.value = next
        for (const listener of [...snapshotStore.listeners]) {
          try {
            listener(next)
          } catch (error) {
            /* one broken subscriber must not break the others */
          }
        }
      },
      subscribe(listener) {
        snapshotStore.listeners.add(listener)
        return () => {
          snapshotStore.listeners.delete(listener)
        }
      },
    }

    function useSnapshot() {
      const [snapshot, setSnapshot] = useState(() => snapshotStore.get())
      useEffect(() => {
        setSnapshot(snapshotStore.get())
        return snapshotStore.subscribe(setSnapshot)
      }, [])
      return snapshot
    }

    let fontsPromise = null

    function loadFonts() {
      if (fontsPromise === null) {
        fontsPromise = fetch(FONTS_ROUTE, {
          credentials: 'same-origin',
          headers: { accept: 'application/json' },
        })
          .then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            return response.json()
          })
          .then((body) => {
            const list = body && Array.isArray(body.fonts) ? body.fonts : []
            const fonts = list.filter((name) => typeof name === 'string' && name.length > 0)
            return fonts.length > 0
              ? { fonts, source: 'system' }
              : { fonts: FALLBACK_FONTS.slice(), source: 'fallback' }
          })
          .catch(() => ({ fonts: FALLBACK_FONTS.slice(), source: 'fallback' }))
      }
      return fontsPromise
    }

    function useFonts() {
      const [state, setState] = useState(() => ({
        fonts: FALLBACK_FONTS.slice(),
        source: 'loading',
      }))
      useEffect(() => {
        let alive = true
        loadFonts().then((next) => {
          if (alive) setState(next)
        })
        return () => {
          alive = false
        }
      }, [])
      return state
    }

    function detectLanguage() {
      try {
        return String(navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en'
      } catch (error) {
        return 'zh'
      }
    }

    /** Slot locale first, built-in dictionary second. */
    function useTranslator(t) {
      const language = useMemo(detectLanguage, [])
      return useCallback(
        (key) => {
          if (typeof t === 'function') {
            try {
              const value = t(key)
              if (typeof value === 'string' && value.length > 0 && value !== key) return value
            } catch (error) {
              /* fall through to the local dictionary */
            }
          }
          const dictionary = language === 'zh' ? ZH : EN
          return dictionary[key] || key
        },
        [t, language],
      )
    }

    function quoteFamily(name) {
      return `"${String(name).replace(/["\\]/g, '')}"`
    }

    /** '"钉钉进步体", "Segoe UI"' -> '钉钉进步体' */
    function displayFamily(stored) {
      const list = String(stored || '')
        .split(',')
        .map((part) => part.trim().replace(/^["']|["']$/g, ''))
        .filter((part) => part.length > 0)
      return list.length > 0 ? list[0] : ''
    }

    const MENU_MAX_HEIGHT = 352

    function chevronIcon() {
      return h(
        'svg',
        { className: 'dshfp-chevron', viewBox: '0 0 12 12', 'aria-hidden': 'true' },
        h('path', {
          d: 'M2.5 4.5 6 8l3.5-3.5',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.3,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      )
    }

    function FamilyRow({ tr, def, fonts, stored, onSelect }) {
      const current = displayFamily(stored)
      const title = tr(def.title)
      const [open, setOpen] = useState(false)
      const [query, setQuery] = useState('')
      const [activeIndex, setActiveIndex] = useState(0)
      const [placement, setPlacement] = useState(null)
      const triggerRef = useRef(null)
      const panelRef = useRef(null)
      const searchRef = useRef(null)

      const options = useMemo(() => {
        const seen = new Set()
        const list = []
        const remember = (name) => {
          if (name.length === 0 || seen.has(name)) return
          seen.add(name)
          list.push(name)
        }
        for (const name of fonts) remember(name)
        // The stored value may be a font that is missing from this machine;
        // keep it selectable so the row never shows a blank control.
        if (current.length > 0) remember(current)
        return list
      }, [fonts, current])

      const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase()
        if (needle.length === 0) return options
        return options.filter((name) => name.toLowerCase().includes(needle))
      }, [options, query])

      const entries = useMemo(
        () =>
          [{ value: '', label: tr('default') }].concat(
            filtered.map((name) => ({ value: name, label: name })),
          ),
        [filtered, tr],
      )

      const pick = useCallback(
        (value) => {
          setOpen(false)
          onSelect(value)
        },
        [onSelect],
      )

      const position = useCallback(() => {
        const element = triggerRef.current
        if (element === null) return null
        const rect = element.getBoundingClientRect()
        const flip =
          rect.bottom + MENU_MAX_HEIGHT > window.innerHeight && rect.top > MENU_MAX_HEIGHT
        return {
          right: Math.max(8, window.innerWidth - rect.right),
          top: flip ? null : rect.bottom + 6,
          bottom: flip ? window.innerHeight - rect.top + 6 : null,
        }
      }, [])

      const toggle = useCallback(() => {
        if (open) {
          setOpen(false)
          return
        }
        const next = position()
        if (next === null) return
        setPlacement(next)
        setQuery('')
        setActiveIndex(Math.max(0, entries.findIndex((entry) => entry.value === current)))
        setOpen(true)
      }, [open, position, entries, current])

      useEffect(() => {
        if (!open) return undefined
        const onPointerDown = (event) => {
          if (panelRef.current !== null && panelRef.current.contains(event.target)) return
          if (triggerRef.current !== null && triggerRef.current.contains(event.target)) return
          setOpen(false)
        }
        document.addEventListener('mousedown', onPointerDown, true)
        return () => document.removeEventListener('mousedown', onPointerDown, true)
      }, [open])

      useEffect(() => {
        if (open && searchRef.current !== null) searchRef.current.focus()
      }, [open])

      // The settings column scrolls under the fixed panel: keep it glued.
      useEffect(() => {
        if (!open) return undefined
        const reposition = () => {
          const next = position()
          if (next !== null) setPlacement(next)
        }
        window.addEventListener('scroll', reposition, true)
        window.addEventListener('resize', reposition)
        return () => {
          window.removeEventListener('scroll', reposition, true)
          window.removeEventListener('resize', reposition)
        }
      }, [open, position])

      const onKeyDown = (event) => {
        if (event.key === 'Escape') {
          if (open) {
            event.stopPropagation()
            setOpen(false)
          }
          return
        }
        if (!open) {
          if (
            event.key === 'ArrowDown' ||
            event.key === 'ArrowUp' ||
            event.key === 'Enter' ||
            event.key === ' '
          ) {
            event.preventDefault()
            toggle()
          }
          return
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setActiveIndex((index) => Math.min(entries.length - 1, index + 1))
        } else if (event.key === 'ArrowUp') {
          event.preventDefault()
          setActiveIndex((index) => Math.max(0, index - 1))
        } else if (event.key === 'Enter') {
          event.preventDefault()
          const entry = entries[activeIndex]
          if (entry !== undefined) pick(entry.value)
        } else if (event.key === 'Tab') {
          setOpen(false)
        }
      }

      return h(
        'div',
        { className: 'dshfp-row' },
        h(
          'div',
          { className: 'dshfp-text' },
          h('div', { className: 'dshfp-title' }, title),
          h('div', { className: 'dshfp-desc' }, tr(def.description)),
        ),
        h(
          'div',
          { className: 'dshfp-control' },
          h(
            'button',
            {
              ref: triggerRef,
              type: 'button',
              className: 'dshfp-trigger',
              'aria-label': title,
              'aria-haspopup': 'listbox',
              'aria-expanded': open,
              title,
              onClick: toggle,
              onKeyDown,
            },
            h(
              'span',
              {
                className: 'dshfp-triggerText',
                style: current.length > 0 ? { fontFamily: quoteFamily(current) } : undefined,
              },
              current.length > 0 ? current : tr('default'),
            ),
            chevronIcon(),
          ),
          open && placement !== null
            ? h(
                'div',
                {
                  ref: panelRef,
                  className: 'dshfp-menu',
                  role: 'listbox',
                  'aria-label': title,
                  style: {
                    right: `${placement.right}px`,
                    top: placement.top === null ? undefined : `${placement.top}px`,
                    bottom: placement.bottom === null ? undefined : `${placement.bottom}px`,
                  },
                },
                h('input', {
                  ref: searchRef,
                  className: 'dshfp-search',
                  type: 'search',
                  value: query,
                  placeholder: tr('search'),
                  'aria-label': tr('search'),
                  spellCheck: false,
                  autoComplete: 'off',
                  onChange: (event) => {
                    setQuery(event.target.value)
                    setActiveIndex(0)
                  },
                  onKeyDown,
                }),
                h(
                  'div',
                  { className: 'dshfp-list' },
                  filtered.length === 0 && query.trim().length > 0
                    ? h('div', { className: 'dshfp-empty' }, tr('empty'))
                    : entries.map((entry, index) =>
                        h(
                          'div',
                          {
                            key: entry.value === '' ? '__default__' : entry.value,
                            className:
                              'dshfp-item' + (entry.value === '' ? ' dshfp-itemDefault' : ''),
                            role: 'option',
                            title: entry.label,
                            'aria-selected': entry.value === current,
                            'data-active': index === activeIndex ? 'true' : undefined,
                            style:
                              entry.value === ''
                                ? undefined
                                : { fontFamily: quoteFamily(entry.value) },
                            onMouseEnter: () => setActiveIndex(index),
                            onClick: () => pick(entry.value),
                          },
                          h('span', { className: 'dshfp-itemName' }, entry.label),
                          entry.value === current
                            ? h('span', { className: 'dshfp-itemCheck' }, '✓')
                            : null,
                        ),
                      ),
                ),
              )
            : null,
        ),
      )
    }

    function FontPickerCell(props) {
      const snapshot = useSnapshot()
      const fontState = useFonts()
      const fonts = fontState.fonts
      const tr = useTranslator(props.t)
      const [drafts, setDrafts] = useState({})

      const families = snapshot && snapshot.fontFamilies ? snapshot.fontFamilies : {}

      const choose = useCallback((role, value) => {
        setDrafts((previous) => ({ ...previous, [role]: value }))
        const theme = runtime.theme
        if (theme !== null && typeof theme.setFontFamily === 'function') {
          theme.setFontFamily(role, value)
          return
        }
        // No setFontFamily on this build: fall back to the CSS variable the
        // shipped theme reads, so the choice still takes effect.
        document.body.style.setProperty(
          `--dsh-font-family-${role}`,
          value.length > 0 ? quoteFamily(value) : '',
        )
      }, [])

      return h(
        'div',
        { className: 'dshfp-cell', 'data-dsh-plugin': 'font-dropdown' },
        ROLE_DEFS.map((def) =>
          h(FamilyRow, {
            key: def.role,
            tr,
            def,
            fonts,
            stored: drafts[def.role] !== undefined ? drafts[def.role] : families[def.role] || '',
            onSelect: (value) => choose(def.role, value),
          }),
        ),
        fontState.source === 'fallback' ? h('div', { className: 'dshfp-hint' }, tr('fallback')) : null,
      )
    }

    return {
      inject: ['slots', 'locale', 'theme'],
      apply(ctx) {
        ctx.locale.register(LOCALE_NS, { zh: ZH, en: EN })

        const theme = ctx.get('theme')
        runtime.theme = theme !== undefined && theme !== null ? theme : null
        if (runtime.theme !== null && typeof runtime.theme.getTheme === 'function') {
          snapshotStore.set(runtime.theme.getTheme())
        }

        ctx.effect(
          () =>
            ctx.on('theme/change', (next) => {
              const theme = runtime.theme
              const snapshot =
                theme !== null && typeof theme.getTheme === 'function'
                  ? theme.getTheme()
                  : next && next.fontFamilies
                    ? next
                    : next && next.snapshot
              if (snapshot) snapshotStore.set(snapshot)
            }),
          'font-dropdown: theme snapshot sync',
        )

        ctx.effect(() => {
          const style = document.createElement('style')
          style.setAttribute('data-dsh-plugin', 'font-dropdown')
          style.textContent = CSS
          document.head.appendChild(style)
          return () => style.remove()
        }, 'font-dropdown: styles')

        ctx.slots.inject('settings.general.item', () =>
          ctx.slots.register(
            {
              name: 'settings.general.item',
              id: 'font-dropdown',
              order: 11.5,
              locale: LOCALE_NS,
            },
            FontPickerCell,
          ),
        )
      },
    }
  },
})