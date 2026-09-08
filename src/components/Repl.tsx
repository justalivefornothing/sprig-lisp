import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Closure, isIncomplete, print, type Value } from '../lisp'
import { Leaf } from './Leaf'

export interface Cell {
  id: number
  source: string
  output: string
  value: Value
  error: string | null
}

interface Props {
  cells: Cell[]
  onSubmit: (src: string) => void
  onFocusClosure: (c: Closure) => void
  onClear: () => void
}

const MAX_ROWS = 12

export function Repl({ cells, onSubmit, onFocusClosure, onClear }: Props) {
  const [text, setText] = useState('')
  const [history, setHistory] = useState<string[]>([])
  // Index into history while browsing; null means "editing a fresh line".
  const [cursor, setCursor] = useState<number | null>(null)
  const draft = useRef('')
  const listRef = useRef<HTMLOListElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    // Scroll after paint so late-loading fonts don't leave the last cell clipped.
    const id = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
    return () => cancelAnimationFrame(id)
  }, [cells])

  const submit = () => {
    const src = text.trim()
    if (!src) return
    onSubmit(src)
    setHistory((h) => (h[h.length - 1] === src ? h : [...h, src]))
    setText('')
    setCursor(null)
  }

  const browse = (dir: -1 | 1) => {
    if (history.length === 0) return
    const from = cursor ?? history.length
    const next = from + dir
    if (next < 0) return
    if (cursor === null) draft.current = text
    if (next >= history.length) {
      setCursor(null)
      setText(draft.current)
    } else {
      setCursor(next)
      setText(history[next])
    }
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    if (e.key === 'Enter' && !e.shiftKey) {
      // A balanced form evaluates; an open one just gets another line.
      if (text.trim() === '' || isIncomplete(text)) return
      e.preventDefault()
      submit()
    } else if (e.key === 'ArrowUp' && !text.slice(0, el.selectionStart).includes('\n')) {
      e.preventDefault()
      browse(-1)
    } else if (e.key === 'ArrowDown' && !text.slice(el.selectionEnd).includes('\n')) {
      e.preventDefault()
      browse(1)
    } else if (e.key === 'Escape') {
      setText('')
      setCursor(null)
    }
  }

  const rows = Math.min(MAX_ROWS, Math.max(1, text.split('\n').length))
  const waiting = text.trim() !== '' && isIncomplete(text)

  return (
    <section
      aria-label="REPL"
      className="flex min-h-0 flex-col rounded-2xl border border-sage-200 bg-sage-50/80 shadow-[0_1px_2px_rgba(23,45,27,0.05),0_12px_32px_-16px_rgba(23,45,27,0.25)]"
    >
      <header className="flex items-center justify-between border-b border-sage-200 px-4 py-2.5 sm:px-5">
        <h2 className="font-serif text-sm text-forest-800">
          Notebook <span className="text-sage-400">·</span>{' '}
          <span className="text-bark-700">{cells.length === 1 ? '1 cell' : `${cells.length} cells`}</span>
        </h2>
        <button
          type="button"
          onClick={onClear}
          className="rounded-md px-2 py-1 font-serif text-sm text-forest-700 transition hover:bg-sage-200/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest-600"
        >
          Clear
        </button>
      </header>

      <ol
        ref={listRef}
        className="max-h-[52vh] flex-1 overflow-y-auto px-3 sm:px-4 lg:max-h-none"
        aria-live="polite"
      >
        {cells.length === 0 && (
          <li className="flex flex-col items-center gap-2 py-14 text-center">
            <Leaf className="h-8 w-8 text-sage-400" />
            <p className="font-serif text-forest-800">A blank notebook.</p>
            <p className="max-w-xs font-serif text-sm text-bark-700">
              Type a form below, or load an example. Parentheses are balanced for you: Enter only evaluates
              once every <span className="font-mono">(</span> has its <span className="font-mono">)</span>.
            </p>
          </li>
        )}
        {cells.map((cell) => (
          <li key={cell.id} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2.5 border-b border-sage-200/80 py-3 last:border-b-0">
            <Leaf className="mt-0.5 h-4 w-4 text-forest-700" />
            <div className="min-w-0">
              <pre className="whitespace-pre-wrap break-words font-mono text-[13.5px] leading-relaxed text-forest-900">{cell.source}</pre>
              {cell.output && (
                <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[13.5px] leading-relaxed text-bark-700">{cell.output}</pre>
              )}
              {cell.error ? (
                <p className="mt-1.5 rounded-r-md border-l-2 border-clay-600 bg-clay-100/70 px-2.5 py-1.5 font-mono text-[13px] leading-relaxed text-clay-600">
                  {cell.error}
                </p>
              ) : (
                cell.value !== undefined && (
                  <p className="mt-1 font-mono text-[13.5px] leading-relaxed text-forest-700">
                    <span className="select-none text-sage-400">⇒ </span>
                    {cell.value instanceof Closure ? (
                      <button
                        type="button"
                        onClick={() => onFocusClosure(cell.value as Closure)}
                        title="Inspect this closure's environment"
                        className="rounded underline decoration-forest-600/50 decoration-dotted underline-offset-4 transition hover:text-forest-900 hover:decoration-forest-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
                      >
                        {print(cell.value)}
                      </button>
                    ) : (
                      print(cell.value)
                    )}
                  </p>
                )
              )}
            </div>
          </li>
        ))}
      </ol>

      <form
        className="border-t border-sage-200 px-3 py-3 sm:px-4"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <label htmlFor="repl-input" className="sr-only">
          Sprig expression
        </label>
        <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-x-2.5 rounded-xl border border-sage-300 bg-white px-2.5 py-2 transition focus-within:border-forest-600 focus-within:ring-2 focus-within:ring-forest-600/15">
          <Leaf className={`mt-1 h-4 w-4 ${waiting ? 'text-sage-400' : 'text-forest-700'}`} />
          <textarea
            id="repl-input"
            ref={inputRef}
            value={text}
            rows={rows}
            spellCheck={false}
            autoComplete="off"
            autoFocus
            placeholder="(define (twice f) (lambda (x) (f (f x))))"
            onChange={(e) => {
              setText(e.target.value)
              setCursor(null)
            }}
            onKeyDown={onKeyDown}
            className="w-full resize-none bg-transparent font-mono text-[13.5px] leading-relaxed text-forest-900 outline-none placeholder:text-sage-400"
          />
        </div>
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 px-1 font-serif text-xs text-bark-700/80">
          <span>{waiting ? 'Waiting for a closing paren…' : 'Enter evaluates'}</span>
          <span>Shift+Enter for a newline</span>
          <span>↑ ↓ history</span>
        </p>
      </form>
    </section>
  )
}
