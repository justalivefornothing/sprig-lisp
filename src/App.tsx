import { useCallback, useEffect, useRef, useState } from 'react'
import { Examples } from './components/Examples'
import { Inspector } from './components/Inspector'
import { Leaf } from './components/Leaf'
import { Repl, type Cell } from './components/Repl'
import { Closure, Interpreter, ParseError } from './lisp'
import { examples, type Example } from './lisp/examples'

const MAX_RECENT = 6
const TCO_DEMO = `(define (loop n) (if (= n 0) "landed" (loop (- n 1))))
(loop 1000000)`

export default function App() {
  const interp = useRef<Interpreter | null>(null)
  if (interp.current === null) interp.current = new Interpreter()
  const nextId = useRef(1)
  const booted = useRef(false)

  const [cells, setCells] = useState<Cell[]>([])
  const [focus, setFocus] = useState<Closure | null>(null)
  const [recent, setRecent] = useState<Closure[]>([])

  const focusClosure = useCallback((c: Closure) => {
    setFocus(c)
    if (c.name) setRecent((r) => [c, ...r.filter((x) => x !== c)].slice(0, MAX_RECENT))
  }, [])

  const run = useCallback(
    (src: string) => {
      const it = interp.current!
      it.lastClosure = null
      const { value, output, error } = it.run(src)
      const message = error instanceof ParseError ? `parse error: ${error.message}` : error?.message ?? null
      setCells((cs) => [...cs, { id: nextId.current++, source: src, output, value, error: message }])
      // Follow the closure the user most plausibly cares about: the result if it
      // is one, otherwise whatever was last defined or applied.
      const c = value instanceof Closure ? value : it.lastClosure
      if (c) focusClosure(c)
    },
    [focusClosure],
  )

  const loadExample = useCallback(
    (ex: Example) => {
      for (const cell of ex.cells) run(cell)
    },
    [run],
  )

  const reset = () => {
    interp.current = new Interpreter()
    setCells([])
    setFocus(null)
    setRecent([])
  }

  useEffect(() => {
    if (booted.current) return
    booted.current = true
    loadExample(examples[0])
  }, [loadExample])

  return (
    <div className="mx-auto flex min-h-dvh max-w-7xl flex-col gap-4 px-3 py-4 sm:px-5 sm:py-5 lg:h-dvh lg:overflow-hidden">
      <header className="flex flex-col gap-3 px-1 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-3">
          <Leaf className="mt-1 h-8 w-8 shrink-0 text-forest-700" />
          <div>
            <h1 className="font-serif text-2xl font-semibold leading-tight text-forest-900 sm:text-3xl">Sprig</h1>
            <p className="mt-0.5 max-w-xl font-serif text-sm text-bark-700 sm:text-[15px]">
              A tiny Scheme-flavored Lisp with lexical closures and proper tail calls. Every closure you make can be
              opened up: the inspector draws the frames it captured.
            </p>
          </div>
        </div>
        <Examples onLoad={loadExample} />
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,1fr)]">
        <Repl cells={cells} onSubmit={run} onFocusClosure={focusClosure} onClear={reset} />
        <Inspector focus={focus} recent={recent} onFocus={focusClosure} onTry={run} />
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-2 px-1 font-serif text-xs text-bark-700/80">
        <span>
          Special forms: <span className="font-mono">define lambda if cond let let* begin set! quote and or</span>
        </span>
        <button
          type="button"
          onClick={() => run(TCO_DEMO)}
          className="rounded px-1 text-forest-700 underline decoration-forest-600/40 decoration-dotted underline-offset-4 transition hover:text-forest-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest-600"
        >
          Tail calls run in constant stack — loop a million times
        </button>
      </footer>
    </div>
  )
}
