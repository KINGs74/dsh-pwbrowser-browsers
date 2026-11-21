/**
 * pwbrowser-bundle browser half: the composer's "browser mode" switch.
 *
 * A switch on the left of the composer tool row, next to the other toolbar
 * controls: green means "use the browser for this Session". It reads and writes
 * the host route `/pwbrowser-browsers/mode`, which appends a log-only
 * `browser/mode` event — so a press never writes a command card into the
 * conversation, and this plugin registers no slash command at all (a registered
 * command cannot be hidden from the `/` and `+` menus).
 *
 * The projection's value paints the first frame; the route's answer is the
 * source of truth from then on, re-read on a slow poll and on window focus so a
 * reload, another window, or the model's own turn keeps the dot honest.
 *
 * Loaded by the web client through the package's `dsh.client` declaration
 * (`platform: "web"`, mounted at boot) and kept alive by the host row this
 * package inserts in `cordis.patch.yml`.
 *
 * @module @local/pwbrowser-browsers/client
 */
window.__ModuleLoader__.load({
  id: '@local/pwbrowser-browsers',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')
    const h = React.createElement

    /** Seat: the compact left side of the composer tool row. */
    const SLOT = 'conversation.input.left'
    const ENTRY_ID = 'pwbrowser-browser-mode'
    const ORDER = 30

    /** Must match the host projection key in `index.js`. */
    const PROJECTION = 'browserMode'

    /** Dictionary namespace owned by this plugin. */
    const NS = 'pwbrowser'
    const DICT = {
      zh: {
        'chip.label': '浏览器',
        'chip.on.title': '浏览器已开启：模型会用浏览器打开并操作真实网页，点一下关闭',
        'chip.off.title': '浏览器已关闭：点一下让模型用浏览器打开并操作真实网页',
        'chip.busy': '正在切换浏览器模式…',
        'chip.failed': '切换浏览器模式失败',
        'chip.queued': '本轮结束后生效',
        'token.title': '浏览器扩展 Token',
        'token.desc': '把每个浏览器扩展里的 auth-token 填在这里（只写不回显）。连接会静默建立，不再弹 Allow。输入框留空表示不修改该浏览器。',
        'token.where': '取值位置：浏览器打开 chrome-extension://mmlmfjhmonkocbjadbfplnigmagldckm/manage.html，复制 localStorage["auth-token"] 的值（43 个字符）。',
        'token.chrome': 'Chrome',
        'token.edge': 'Microsoft Edge',
        'token.brave': 'Brave',
        'token.placeholder': '粘贴 token',
        'token.set': '已设置',
        'token.unset': '未设置',
        'token.save': '保存并应用',
        'token.clear': '清除全部',
        'token.saved': '已保存（输入框清空是正常的，token 不会再显示），约 2 秒内应用到该浏览器的连接',
        'token.nothing': '没有要保存的内容：先在输入框里粘贴一个 token',
        'token.rejected': '保存被拒绝：配置已在别处改动，请重试',
        'token.failed': '保存失败',
        'token.unavailable': '这里拿不到可写的配置表单，请在插件列表里点该行进入配置页。',
        'token.loading': '正在读取配置…',
        'token.apply': '应用已保存的 token',
        'token.applied': '已应用到浏览器连接',
        'token.summary': '三个浏览器的扩展 Token 在这一行的配置页里设置，设置后不再弹 Allow。',
      },
      en: {
        'chip.label': 'Browser',
        'chip.on.title': 'Browser mode is on — the model drives real pages; click to turn it off',
        'chip.off.title': 'Browser mode is off — click to let the model drive real pages',
        'chip.busy': 'Switching browser mode…',
        'chip.failed': 'Could not switch browser mode',
        'chip.queued': 'Applies after this turn',
        'token.title': 'Browser extension tokens',
        'token.desc': 'Paste each browser extension\'s auth-token here (write-only). Connections then attach silently instead of asking for "Allow". An empty box leaves that browser unchanged.',
        'token.where': 'Where to find it: open chrome-extension://mmlmfjhmonkocbjadbfplnigmagldckm/manage.html and copy localStorage["auth-token"] (43 characters).',
        'token.chrome': 'Chrome',
        'token.edge': 'Microsoft Edge',
        'token.brave': 'Brave',
        'token.placeholder': 'Paste token',
        'token.set': 'set',
        'token.unset': 'not set',
        'token.save': 'Save and apply',
        'token.clear': 'Clear all',
        'token.saved': 'Saved — the box clears on purpose and the token is never shown again; it reaches that connection within about two seconds',
        'token.nothing': 'Nothing to save: paste a token into at least one box',
        'token.rejected': 'Save rejected: the configuration changed elsewhere, try again',
        'token.failed': 'Save failed',
        'token.unavailable': 'No writable form here — open this row from the plugin list to configure it.',
        'token.loading': 'Reading configuration…',
        'token.apply': 'Apply stored tokens',
        'token.applied': 'Applied to the browser connections',
        'token.summary': 'The three extension tokens are set on this row\'s configuration page; once set, Allow stops appearing.',
      },
    }

    const STYLE_ID = 'pwbrowser-browser-chip-style'
    const CSS = `
.pwb-chip{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 8px;border:none;border-radius:var(--dsw-radius-sm,8px);background:transparent;color:var(--dsw-alias-label-secondary);font-family:inherit;font-size:13px;font-weight:500;line-height:20px;cursor:pointer}
@media (hover:hover){.pwb-chip:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-primary)}}
.pwb-chip:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:2px}
.pwb-chip:active:not(:disabled){transform:translateY(.5px)}
.pwb-chip:disabled{opacity:.65;cursor:progress}
.pwb-chip__dot{flex:0 0 auto;width:6px;height:6px;border-radius:999px;background:var(--dsw-alias-state-idle-primary)}
.pwb-chip[data-pwbrowser-mode='on'] .pwb-chip__dot{background:var(--dsw-alias-state-success-primary)}
.pwb-chip--failed .pwb-chip__dot{background:var(--dsw-alias-state-error-primary)}
@media (max-width:860px){.pwb-chip__label{display:none}}
.pwb-chip__label{white-space:nowrap}
.pwb-form{display:flex;flex-direction:column;gap:12px;padding:4px 0}
.pwb-form__title{margin:0;font-size:13px;font-weight:600;line-height:20px;color:var(--dsw-alias-label-primary)}
.pwb-form__text{margin:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.pwb-form__where{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);word-break:break-all}
.pwb-field{display:flex;flex-direction:column;gap:6px}
.pwb-field__head{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:500;line-height:20px;color:var(--dsw-alias-label-primary)}
.pwb-badge{padding:0 6px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:500;line-height:16px}
.pwb-badge--set{background:var(--dsw-alias-state-success-tertiary,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-state-success-primary,var(--dsw-alias-brand-primary))}
.pwb-input{height:30px;padding:0 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm,8px);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px}
.pwb-input:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:1px}
.pwb-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.pwb-btn{height:28px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm,8px);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px;font-weight:500;cursor:pointer}
.pwb-btn--primary{border-color:transparent;background:var(--dsw-alias-brand-primary);color:#fff}
.pwb-btn:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:2px}
.pwb-btn:disabled{opacity:.55;cursor:default}
.pwb-note{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.pwb-note--error{color:var(--dsw-alias-state-error-primary)}
.pwb-note--ok{color:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary))}
`

    /**
     * The switch's route, resolved against the page's own base so a deployment
     * behind a path prefix keeps working. Must match `MODE_ROUTE` in the host
     * half.
     */
    const MODE_ROUTE = '/pwbrowser-browsers/mode'

    /** Resolve the route against the current document. */
    function modeUrl(sessionId) {
      const base = typeof document === 'undefined' ? 'http://127.0.0.1/' : document.baseURI
      const url = new URL(MODE_ROUTE, base)
      if (typeof sessionId === 'string' && sessionId !== '') url.searchParams.set('sessionId', sessionId)
      return url
    }

    /**
     * The mode of this session, read from and written to the host route.
     *
     * The host is the only source of truth: a press is applied optimistically
     * so the dot flips at once, then overwritten by the response (or rolled
     * back on failure). A slow poll keeps the dot right when another window, a
     * reload, or the model's own turn changed the state first.
     *
     * @param sessionId - the session the switch belongs to.
     * @param projected - the projection's value, used for the first paint.
     * @returns the state, plus `toggle` and `refresh`.
     */
    function useBrowserMode(sessionId, projected) {
      const initial = {
        phase: typeof sessionId === 'string' && sessionId !== '' ? 'loading' : 'unavailable',
        active: projected === true,
        busy: false,
        queued: false,
        error: null,
      }
      const pair = React.useState(initial)
      const state = pair[0]
      const setState = pair[1]
      const aliveRef = React.useRef(true)
      const busyRef = React.useRef(false)

      React.useEffect(() => {
        aliveRef.current = true
        return () => {
          aliveRef.current = false
        }
      }, [])

      React.useEffect(() => {
        if (initial.phase === 'unavailable') return undefined
        let live = true

        const read = async () => {
          if (busyRef.current) return
          try {
            const response = await fetch(modeUrl(sessionId), {
              cache: 'no-store',
              headers: { accept: 'application/json' },
              credentials: 'same-origin',
            })
            if (!response.ok) throw new Error('HTTP ' + String(response.status))
            const body = await response.json()
            if (!live || !aliveRef.current) return
            setState((previous) => ({
              phase: 'ready',
              active: body.active === true,
              busy: previous.busy,
              queued: body.queued === true,
              error: null,
            }))
          } catch (error) {
            if (!live || !aliveRef.current) return
            reportFailure('read browser mode', error)
            setState((previous) => ({ ...previous, phase: 'error', error: String(error && error.message ? error.message : error) }))
          }
        }

        void read()
        const timer = setInterval(() => { void read() }, 4000)
        const onFocus = () => { void read() }
        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
          window.addEventListener('focus', onFocus)
        }
        return () => {
          live = false
          clearInterval(timer)
          if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
            window.removeEventListener('focus', onFocus)
          }
        }
      }, [sessionId])

      const toggle = React.useCallback(async () => {
        if (busyRef.current || initial.phase === 'unavailable') return null
        const wanted = !state.active
        busyRef.current = true
        setState((previous) => ({ ...previous, active: wanted, busy: true, error: null }))
        try {
          const response = await fetch(modeUrl(sessionId), {
            method: 'POST',
            cache: 'no-store',
            credentials: 'same-origin',
            headers: { accept: 'application/json', 'content-type': 'application/json' },
            body: JSON.stringify({ active: wanted }),
          })
          const body = await response.json().catch(() => undefined)
          if (!response.ok || body === undefined) {
            throw new Error(body && body.error ? String(body.error) : 'HTTP ' + String(response.status))
          }
          if (aliveRef.current) {
            setState({ phase: 'ready', active: body.active === true, busy: false, queued: body.queued === true, error: null })
          }
          return null
        } catch (error) {
          const message = String(error && error.message ? error.message : error)
          reportFailure('switch browser mode', error)
          if (aliveRef.current) {
            setState((previous) => ({ ...previous, active: !wanted, busy: false, queued: false, error: message }))
          }
          return message
        } finally {
          busyRef.current = false
        }
      }, [sessionId, state.active, initial.phase])

      return { state, toggle }
    }

    /**
     * Install the chip styles once per document.
     * @param doc - the owning document, when there is one.
     */
    function installStyles(doc) {
      try {
        if (!doc || typeof doc.createElement !== 'function') return
        if (doc.getElementById(STYLE_ID) !== null) return
        const style = doc.createElement('style')
        style.id = STYLE_ID
        style.textContent = CSS
        const head = doc.head || doc.documentElement
        if (head) head.appendChild(style)
      } catch (error) {
        // Styling is cosmetic: an unstyled chip still works.
      }
    }

    /**
     * The switch itself: a dot plus its label, the same shape as the desktop
     * control switch next to it. Green means the model drives real pages.
     *
     * Props: the slot's runtime share (`sessionId`, `useProjection`) and the
     * locale seat's `t`.
     *
     * @param props - component props.
     * @returns the switch element.
     */
    function BrowserChip(props) {
      const t = props.t
      const useProjection = props.useProjection
      const projected = typeof useProjection === 'function' ? useProjection(PROJECTION) : undefined
      const { state, toggle } = useBrowserMode(props.sessionId, projected)
      const active = state.active === true

      const title = state.busy
        ? t('chip.busy')
        : state.error !== null
          ? t('chip.failed') + ': ' + state.error
          : state.queued
            ? t('chip.queued')
            : active ? t('chip.on.title') : t('chip.off.title')

      return h('button', {
        type: 'button',
        className: [
          'pwb-chip',
          state.error !== null ? 'pwb-chip--failed' : '',
        ].filter(Boolean).join(' '),
        'aria-pressed': active,
        'aria-label': title,
        'data-pwbrowser-mode': active ? 'on' : 'off',
        'data-busy': state.busy ? '1' : '0',
        title,
        disabled: state.busy,
        onClick: () => {
          void toggle()
        },
      },
        h('span', { className: 'pwb-chip__dot', 'aria-hidden': 'true' }),
        h('span', { className: 'pwb-chip__label' }, t('chip.label')))
    }

    /** Package name this browser half belongs to; the plugin page keys on it. */
    const PKG = '@local/pwbrowser-browsers'

    /** The three write-only token fields, in page order. */
    const TOKEN_FIELDS = [
      { key: 'chromeToken', labelKey: 'token.chrome' },
      { key: 'edgeToken', labelKey: 'token.edge' },
      { key: 'braveToken', labelKey: 'token.brave' },
    ]

    /**
     * Which secret paths the host reports as set. The values never reach the
     * browser — the host strips them and reports `{ path, set }` instead — so the
     * page can only say "already set" and never show a token back.
     *
     * The flag rides the namespace view, not the form snapshot: the form keeps
     * `value`/`revision`/`writable`, while `secrets` stays on the describe view
     * the mirror holds.
     *
     * @param view - the mirror's current describe view.
     * @param ns - the namespace this card configures.
     * @returns path (dot-joined) to whether a value is stored.
     */
    function secretFlags(view, ns) {
      const flags = {}
      const namespaces = view !== undefined && view !== null && Array.isArray(view.namespaces) ? view.namespaces : []
      const section = namespaces.find(entry => entry !== null && typeof entry === 'object' && entry.ns === ns)
      const secrets = section !== undefined && section !== null && Array.isArray(section.secrets) ? section.secrets : []
      for (const secret of secrets) {
        if (secret === null || typeof secret !== 'object' || !Array.isArray(secret.path)) continue
        flags[secret.path.join('.')] = secret.set === true
      }
      return flags
    }

    /**
     * The namespace a Loader row's configuration lives under: the row's patch id,
     * which is also the id half of a `plugins.row.config` key.
     */
    const FORM_NAMESPACE = ENTRY_ID

    /**
     * Read this row's own configuration form from the client `configForms` service.
     *
     * The bundle page's card (`plugins.bundle.config`) is rendered without a `form`
     * prop — only row pages receive one — so the card subscribes to the namespace
     * itself. The service ships with the settings UI; when it is not reachable the
     * caller falls back to whatever prop was passed.
     *
     * @param hostCtx - this plugin's client context.
     * @returns `{ state, mutate }` shaped like a slot-provided form, or null.
     */
    function useServiceForm(hostCtx) {
      const storeRef = React.useRef(null)
      if (storeRef.current === null) {
        // The settings service is optional: a profile without the settings UI
        // simply keeps the fallback message instead of blanking the slot.
        try {
          const forms = hostCtx !== undefined && hostCtx !== null && typeof hostCtx.get === 'function'
            ? hostCtx.get('configForms')
            : undefined
          if (forms !== undefined && forms !== null && typeof forms.get === 'function') {
            storeRef.current = forms.get(FORM_NAMESPACE)
          }
        } catch (error) {
          reportFailure('read the token form', error)
        }
      }
      const store = storeRef.current
      const pair = React.useState(() => (store === null || store === undefined ? null : store.getSnapshot()))
      const snapshot = pair[0]
      const setSnapshot = pair[1]

      React.useEffect(() => {
        if (store === null || store === undefined) return undefined
        setSnapshot(store.getSnapshot())
        return store.subscribe(() => setSnapshot(store.getSnapshot()))
      }, [store, setSnapshot])

      if (store === null || store === undefined || snapshot === null || snapshot === undefined) return null
      const revision = snapshot.revision
      return {
        state: snapshot,
        mutate: (ops, expected) => store.mutate(ops, expected === undefined ? revision : expected),
      }
    }

    /**
     * Whether each secret slot already holds a value, straight from the settings
     * mirror. This is the same "已设置 / 未设置" signal the host produces for its
     * own secret inputs, so the badge flips as soon as a save is folded back in.
     *
     * @param hostCtx - this plugin's client context.
     * @returns token key to "has a stored value".
     */
    function useSecretFlags(hostCtx) {
      const pair = React.useState({})
      const setFlags = pair[1]
      React.useEffect(() => {
        if (hostCtx === undefined || hostCtx === null || typeof hostCtx.get !== 'function') return undefined
        let face
        try {
          const forms = hostCtx.get('configForms')
          face = forms === undefined || forms === null ? undefined : forms.describe()
        } catch (error) {
          reportFailure('read the token status', error)
          return undefined
        }
        if (face === undefined || face === null || typeof face.subscribe !== 'function') return undefined
        const read = () => {
          let snapshot
          try {
            snapshot = face.getSnapshot()
          } catch (error) {
            reportFailure('read the token status', error)
            return
          }
          const view = snapshot === null || snapshot === undefined ? undefined : snapshot.view
          const next = secretFlags(view, FORM_NAMESPACE)
          setFlags(previous => {
            const same = Object.keys(next).length === Object.keys(previous).length
              && Object.keys(next).every(key => previous[key] === next[key])
            return same ? previous : next
          })
        }
        read()
        try {
          void face.ensure()
        } catch (error) {
          reportFailure('load the token status', error)
        }
        const stop = face.subscribe(read)
        return typeof stop === 'function' ? stop : undefined
      }, [hostCtx, setFlags])
      return pair[0]
    }

    /**
     * The plugin page's token form.
     *
     * Rendered in `plugins.row.config`, which is the one plugin-manager seat that
     * hands a page the row's writable configuration form (`props.form`). Saving
     * writes this row's config; the host half then pushes the tokens onto the
     * three MCP rows, so the extension connects without asking for "Allow".
     *
     * @param props - `PluginConfigViewProps` plus the locale seat's `t`.
     * @returns the form (page) or a one-line note (summary card).
     */
    function TokenConfigView(props) {
      const t = props.t
      const provided = props.form === undefined ? null : props.form
      // Only reach for the settings service when the seat did not hand us a form.
      const fallback = useServiceForm(provided === null ? props.hostCtx : null)
      const flags = useSecretFlags(props.hostCtx)
      const form = provided === null ? fallback : provided
      const state = form === null || form === undefined ? undefined : form.state
      const pair = React.useState({ chromeToken: '', edgeToken: '', braveToken: '' })
      const draft = pair[0]
      const setDraft = pair[1]
      const busyPair = React.useState(false)
      const busy = busyPair[0]
      const setBusy = busyPair[1]
      const notePair = React.useState(null)
      const note = notePair[0]
      const setNote = notePair[1]
      const aliveRef = React.useRef(true)

      React.useEffect(() => {
        aliveRef.current = true
        return () => {
          aliveRef.current = false
        }
      }, [])

      const status = state === undefined ? 'loading' : state.status
      const writable = state !== undefined && state.writable !== false

      const change = React.useCallback((key) => (event) => {
        const value = typeof event?.target?.value === 'string' ? event.target.value : ''
        setDraft(current => ({ ...current, [key]: value }))
      }, [setDraft])

      const submit = React.useCallback((ops, done) => {
        if (form === null || form === undefined || busy) return Promise.resolve()
        setBusy(true)
        setNote(null)
        return form.mutate(ops, state === undefined ? undefined : state.revision).then((accepted) => {
          if (!aliveRef.current) return
          if (accepted) {
            setDraft({ chromeToken: '', edgeToken: '', braveToken: '' })
            setNote({ kind: 'ok', text: done })
          } else {
            setNote({ kind: 'error', text: t('token.rejected') })
          }
        }, (error) => {
          if (!aliveRef.current) return
          setNote({ kind: 'error', text: `${t('token.failed')}: ${error instanceof Error ? error.message : String(error)}` })
        }).then(() => {
          if (aliveRef.current) setBusy(false)
        })
      }, [busy])

      const save = React.useCallback(() => {
        const ops = TOKEN_FIELDS
          .filter(field => draft[field.key].trim() !== '')
          .map(field => ({ op: 'set', path: [field.key], value: draft[field.key].trim() }))
        if (ops.length === 0) {
          setNote({ kind: 'error', text: t('token.nothing') })
          return
        }
        void submit(ops, t('token.saved'))
      }, [draft, submit])

      const clearAll = React.useCallback(() => {
        void submit(TOKEN_FIELDS.map(field => ({ op: 'unset', path: [field.key] })), t('token.applied'))
      }, [submit])

      if (props.view === 'summary') {
        return h('p', { className: 'pwb-form__text' }, t('token.summary'))
      }
      if (form === null || form === undefined || status === 'unavailable') {
        return h('p', { className: 'pwb-form__text' }, t('token.unavailable'))
      }
      if (status === 'loading') {
        return h('p', { className: 'pwb-form__text' }, t('token.loading'))
      }

      const fields = TOKEN_FIELDS.map(field => h('label', { key: field.key, className: 'pwb-field' },
        h('span', { className: 'pwb-field__head' },
          t(field.labelKey),
          h('span', { className: flags[field.key] === true ? 'pwb-badge pwb-badge--set' : 'pwb-badge' },
            flags[field.key] === true ? t('token.set') : t('token.unset'))),
        h('input', {
          className: 'pwb-input',
          type: 'password',
          autoComplete: 'off',
          spellCheck: false,
          placeholder: t('token.placeholder'),
          value: draft[field.key],
          disabled: busy || !writable,
          onChange: change(field.key),
        })))

      return h('div', { className: 'pwb-form' },
        h('p', { className: 'pwb-form__title' }, t('token.title')),
        h('p', { className: 'pwb-form__text' }, t('token.desc')),
        h('p', { className: 'pwb-form__where' }, t('token.where')),
        fields,
        h('div', { className: 'pwb-actions' },
          h('button', {
            type: 'button',
            className: 'pwb-btn pwb-btn--primary',
            disabled: busy || !writable,
            onClick: save,
          }, t('token.save')),
          h('button', {
            type: 'button',
            className: 'pwb-btn',
            disabled: busy || !writable,
            onClick: clearAll,
          }, t('token.clear'))),
        note === null ? null : h('p', {
          className: note.kind === 'ok' ? 'pwb-note pwb-note--ok' : 'pwb-note pwb-note--error',
          role: 'status',
        }, note.text))
    }

    /**
     * Report one contained slot registration failure.
     * @param what - which seat failed.
     * @param error - the cause.
     */
    function reportFailure(what, error) {
      try {
        console.error(`[pwbrowser] ${what} failed:`, error)
      } catch (ignored) {
        /* Ignore. */
      }
    }

    /**
     * Register the chip and its copy.
     *
     * @param ctx - client root context.
     */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, DICT), 'pwbrowser-bundle: dictionaries')
      const t = ctx.locale.bind(NS)

      // The switch talks to the host route directly, so a press never writes a
      // command card into the conversation and no command has to be registered
      // (a registered command cannot be hidden from the `/` and `+` menus).
      try {
        ctx.slots.inject(SLOT, () => ctx.slots.register({
          name: SLOT,
          id: ENTRY_ID,
          order: ORDER,
          locale: NS,
          label: () => t('chip.label'),
        }, BrowserChip))
      } catch (error) {
        // A failed registration costs this one control and nothing else.
        reportFailure('browser chip', error)
      }

      // The token form. `plugins.row.config` is keyed `<package>#<row id>`, and a
      // bundle-inserted row is addressed by its include id, so both spellings are
      // registered: whichever one the manager asks for finds the page.
      for (const key of [`${PKG}#include:${ENTRY_ID}`, `${PKG}#${ENTRY_ID}`]) {
        try {
          ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
            name: 'plugins.row.config',
            key,
            locale: NS,
          }, (props) => h(TokenConfigView, { ...props, hostCtx: props.hostCtx === undefined ? ctx : props.hostCtx })))
        } catch (error) {
          reportFailure(`token row page (${key})`, error)
        }
      }

      // The bundle page's card. It is rendered without a `form` prop, so the view
      // subscribes to this row's namespace through the `configForms` service and
      // edits the same configuration the row page does.
      try {
        ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
          name: 'plugins.bundle.config',
          key: PKG,
          locale: NS,
        }, (props) => h(TokenConfigView, { ...props, hostCtx: props.hostCtx === undefined ? ctx : props.hostCtx })))
      } catch (error) {
        reportFailure('token bundle card', error)
      }
    }

    installStyles(typeof document === 'undefined' ? undefined : document)

    exports.inject = ['slots', 'locale']
    exports.apply = apply
    return module.exports
  },
})