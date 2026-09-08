import { Builtin, Closure, Sym, type Value } from './types'

const escapeString = (s: string): string =>
  '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t') + '"'

/**
 * Renders a value the way the REPL shows it (`write` semantics: strings are
 * quoted). Pass `display: true` for `display` semantics where strings are raw.
 */
export function print(v: Value, display = false): string {
  if (v === undefined) return '#<void>'
  if (typeof v === 'number') return Number.isNaN(v) ? '+nan.0' : String(v)
  if (typeof v === 'string') return display ? v : escapeString(v)
  if (typeof v === 'boolean') return v ? '#t' : '#f'
  if (v instanceof Sym) return v.name
  if (v instanceof Closure) return v.name ? `#<procedure ${v.name}>` : '#<procedure>'
  if (v instanceof Builtin) return `#<builtin ${v.name}>`
  if (v.length === 2 && v[0] === Sym.for('quote')) return `'${print(v[1], display)}`
  return `(${v.map((x) => print(x, display)).join(' ')})`
}
