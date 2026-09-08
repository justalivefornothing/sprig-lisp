/** The leaf glyph used as the REPL prompt and app mark: a leaf blade with a pale midrib. */
export function Leaf({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M3.5 20.5C3.5 11 10 4 21 3c-.6 11-7.5 17.5-17.5 17.5z" fill="currentColor" />
      <path d="M5.5 18.5 18 6" stroke="#eef3ea" strokeWidth="1.3" strokeLinecap="round" opacity="0.9" />
    </svg>
  )
}
