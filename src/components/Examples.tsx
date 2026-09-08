import { examples, type Example } from '../lisp/examples'

interface Props {
  onLoad: (example: Example) => void
}

export function Examples({ onLoad }: Props) {
  return (
    <nav aria-label="Examples" className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <span className="font-serif text-sm italic text-bark-700">Load an example</span>
      {examples.map((ex) => (
        <button
          key={ex.name}
          type="button"
          title={ex.blurb}
          onClick={() => onLoad(ex)}
          className="rounded-full border border-sage-300 bg-white/70 px-3 py-1 font-mono text-xs text-forest-700 shadow-[0_1px_0_rgba(23,45,27,0.04)] transition hover:-translate-y-px hover:border-forest-600 hover:bg-white hover:text-forest-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest-600 active:translate-y-0"
        >
          {ex.name}
        </button>
      ))}
    </nav>
  )
}
