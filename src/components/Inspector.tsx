import { useState } from 'react'
import { Closure, print } from '../lisp'
import { closureSource, frameChain, type FrameNode } from '../lisp/inspector'
import { Leaf } from './Leaf'

interface Props {
  focus: Closure | null
  recent: Closure[]
  onFocus: (c: Closure) => void
  onTry: (src: string) => void
}

const TRY_ME = '(define (twice f) (lambda (x) (f (f x))))'

const frameTitle = (node: FrameNode): string => {
  if (node.kind === 'global') return 'global frame'
  if (node.kind === 'closure') return 'closure'
  return node.label === 'let' || node.label === 'let*' ? `${node.label} frame` : `call frame · ${node.label}`
}

export function Inspector({ focus, recent, onFocus, onTry }: Props) {
  const [showBuiltins, setShowBuiltins] = useState(false)

  return (
    <aside
      aria-label="Environment inspector"
      className="flex min-h-0 flex-col rounded-2xl border border-sage-200 bg-sage-50/60 shadow-[0_1px_2px_rgba(23,45,27,0.05),0_12px_32px_-16px_rgba(23,45,27,0.25)]"
    >
      <header className="border-b border-sage-200 px-4 py-2.5 sm:px-5">
        <h2 className="font-serif text-sm text-forest-800">
          Environment{' '}
          {focus && (
            <>
              <span className="text-sage-400">·</span> <span className="font-mono text-[13px] text-bark-700">{print(focus)}</span>
            </>
          )}
        </h2>
        {recent.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Recent closures">
            {recent.map((c, i) => {
              const active = c === focus
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => onFocus(c)}
                    aria-pressed={active}
                    className={`rounded-full border px-2.5 py-0.5 font-mono text-xs transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest-600 ${
                      active
                        ? 'border-forest-700 bg-forest-700 text-sage-50'
                        : 'border-sage-300 bg-white text-forest-700 hover:border-forest-600 hover:text-forest-900'
                    }`}
                  >
                    {c.name}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        {focus ? (
          <FrameCard node={frameChain(focus, showBuiltins)} focus={focus} onFocus={onFocus} onToggleBuiltins={() => setShowBuiltins((s) => !s)} showBuiltins={showBuiltins} />
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
            <Leaf className="h-8 w-8 text-sage-400" />
            <p className="font-serif text-forest-800">Nothing to inspect yet.</p>
            <p className="max-w-xs font-serif text-sm text-bark-700">
              Define a procedure or call one and its chain of frames — global, enclosing calls, <span className="font-mono">let</span>s — stacks
              up here.
            </p>
            <button
              type="button"
              onClick={() => onTry(TRY_ME)}
              className="mt-2 rounded-lg border border-sage-300 bg-white px-3 py-1.5 font-mono text-xs text-forest-700 transition hover:border-forest-600 hover:text-forest-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest-600"
            >
              {TRY_ME}
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}

interface CardProps {
  node: FrameNode
  focus: Closure
  showBuiltins: boolean
  onFocus: (c: Closure) => void
  onToggleBuiltins: () => void
}

function FrameCard({ node, focus, showBuiltins, onFocus, onToggleBuiltins }: CardProps) {
  const isLeaf = node.kind === 'closure'
  // The frame the closure directly captured is the interesting one: tint it.
  const captured = node.child?.kind === 'closure'

  return (
    <div
      className={`rounded-xl border p-3 shadow-[0_1px_2px_rgba(23,45,27,0.06),0_10px_24px_-14px_rgba(23,45,27,0.35)] ${
        isLeaf
          ? 'border-forest-700/40 bg-forest-700 text-sage-50'
          : captured
            ? 'border-moss-500/50 bg-white'
            : 'border-sage-200 bg-white/70'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className={`font-serif text-[13px] ${isLeaf ? 'text-sage-200' : 'text-forest-800'}`}>
          {frameTitle(node)}
          {isLeaf && <span className="ml-2 font-mono text-sage-50">{node.label}</span>}
        </h3>
        {node.kind === 'global' && node.hiddenBuiltins > 0 && (
          <button
            type="button"
            onClick={onToggleBuiltins}
            className="rounded px-1.5 py-0.5 font-serif text-xs text-bark-700 transition hover:bg-sage-200/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest-600"
          >
            {showBuiltins ? 'hide builtins' : `+ ${node.hiddenBuiltins} builtins`}
          </button>
        )}
      </div>

      {node.bindings.length === 0 ? (
        <p className="mt-1.5 font-serif text-xs italic text-sage-400">no bindings</p>
      ) : (
        <dl className="mt-1.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 font-mono text-[13px] leading-relaxed">
          {node.bindings.map((b) => (
            <div key={b.name} className="contents">
              <dt className={isLeaf ? 'text-sage-300' : 'text-forest-700'}>{b.name}</dt>
              <dd className={`min-w-0 truncate ${isLeaf ? 'text-sage-50' : 'text-forest-900'}`} title={b.text}>
                {b.value instanceof Closure && b.value !== focus ? (
                  <button
                    type="button"
                    onClick={() => onFocus(b.value as Closure)}
                    title="Inspect this closure"
                    className="rounded underline decoration-forest-600/50 decoration-dotted underline-offset-4 transition hover:text-forest-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
                  >
                    {b.text}
                  </button>
                ) : (
                  b.text
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {isLeaf && (
        <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-forest-800/70 px-2.5 py-2 font-mono text-xs leading-relaxed text-sage-100">
          {closureSource(focus)}
        </pre>
      )}

      {node.child && (
        <div className="mt-3 ml-1.5 sm:ml-3">
          <FrameCard node={node.child} focus={focus} showBuiltins={showBuiltins} onFocus={onFocus} onToggleBuiltins={onToggleBuiltins} />
        </div>
      )}
    </div>
  )
}
