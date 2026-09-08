import { apply, type EvalHooks } from './eval'
import { print } from './printer'
import { Builtin, Closure, Env, LispError, Sym, isList, type Value } from './types'

type Fn = (args: Value[]) => Value

const plural = (n: number) => (n === 1 ? 'argument' : 'arguments')

function checkArity(name: string, args: Value[], min: number, max: number): void {
  if (args.length < min || args.length > max) {
    const want = min === max ? `${min}` : max === Infinity ? `at least ${min}` : `${min} to ${max}`
    throw new LispError(`${name}: expected ${want} ${plural(max === Infinity ? min : max)}, got ${args.length}`)
  }
}

const num = (v: Value, name: string): number => {
  if (typeof v !== 'number') throw new LispError(`${name}: expected a number, got ${print(v)}`)
  return v
}
const str = (v: Value, name: string): string => {
  if (typeof v !== 'string') throw new LispError(`${name}: expected a string, got ${print(v)}`)
  return v
}
const list = (v: Value, name: string): Value[] => {
  if (!isList(v)) throw new LispError(`${name}: expected a list, got ${print(v)}`)
  return v
}
const int = (v: Value, name: string): number => {
  const n = num(v, name)
  if (!Number.isInteger(n)) throw new LispError(`${name}: expected an integer, got ${print(v)}`)
  return n
}

/** Structural equality (`equal?`): lists compare element-wise, everything else by identity. */
export function equal(a: Value, b: Value): boolean {
  if (isList(a) && isList(b)) return a.length === b.length && a.every((x, i) => equal(x, b[i]))
  return a === b
}

/**
 * Builds the global frame. `output` receives text written by `display` /
 * `newline`; `hooks` are threaded into higher-order builtins so applications
 * made through `map` etc. are still observed by the inspector.
 */
export function makeGlobalEnv(output: (text: string) => void = () => {}, hooks: EvalHooks = {}): Env {
  const env = new Env(null, 'global')
  const def = (name: string, min: number, max: number, fn: Fn): void => {
    env.define(
      name,
      new Builtin(name, (args) => {
        checkArity(name, args, min, max)
        return fn(args)
      }),
    )
  }
  const call = (f: Value, args: Value[]) => apply(f, args, hooks)
  const compare = (name: string, op: (a: number, b: number) => boolean) =>
    def(name, 1, Infinity, (args) => {
      const ns = args.map((a) => num(a, name))
      for (let i = 1; i < ns.length; i++) if (!op(ns[i - 1], ns[i])) return false
      return true
    })

  // Arithmetic
  def('+', 0, Infinity, (args) => args.reduce<number>((acc, a) => acc + num(a, '+'), 0))
  def('*', 0, Infinity, (args) => args.reduce<number>((acc, a) => acc * num(a, '*'), 1))
  def('-', 1, Infinity, (args) => {
    const ns = args.map((a) => num(a, '-'))
    return ns.length === 1 ? -ns[0] : ns.slice(1).reduce((acc, n) => acc - n, ns[0])
  })
  def('/', 1, Infinity, (args) => {
    const ns = args.map((a) => num(a, '/'))
    if (ns.slice(ns.length === 1 ? 0 : 1).some((n) => n === 0)) throw new LispError('/: division by zero')
    return ns.length === 1 ? 1 / ns[0] : ns.slice(1).reduce((acc, n) => acc / n, ns[0])
  })
  def('quotient', 2, 2, ([a, b]) => Math.trunc(int(a, 'quotient') / int(b, 'quotient')))
  def('remainder', 2, 2, ([a, b]) => int(a, 'remainder') % int(b, 'remainder'))
  def('modulo', 2, 2, ([a, b]) => {
    const m = int(b, 'modulo')
    return ((int(a, 'modulo') % m) + m) % m
  })
  def('abs', 1, 1, ([a]) => Math.abs(num(a, 'abs')))
  def('min', 1, Infinity, (args) => Math.min(...args.map((a) => num(a, 'min'))))
  def('max', 1, Infinity, (args) => Math.max(...args.map((a) => num(a, 'max'))))
  def('expt', 2, 2, ([a, b]) => num(a, 'expt') ** num(b, 'expt'))
  def('sqrt', 1, 1, ([a]) => Math.sqrt(num(a, 'sqrt')))
  def('floor', 1, 1, ([a]) => Math.floor(num(a, 'floor')))
  def('round', 1, 1, ([a]) => Math.round(num(a, 'round')))

  // Comparison & logic
  compare('=', (a, b) => a === b)
  compare('<', (a, b) => a < b)
  compare('>', (a, b) => a > b)
  compare('<=', (a, b) => a <= b)
  compare('>=', (a, b) => a >= b)
  def('not', 1, 1, ([a]) => a === false)
  def('eq?', 2, 2, ([a, b]) => a === b || (isList(a) && isList(b) && a.length === 0 && b.length === 0))
  def('equal?', 2, 2, ([a, b]) => equal(a, b))

  // Predicates
  def('null?', 1, 1, ([a]) => isList(a) && a.length === 0)
  def('list?', 1, 1, ([a]) => isList(a))
  def('pair?', 1, 1, ([a]) => isList(a) && a.length > 0)
  def('number?', 1, 1, ([a]) => typeof a === 'number')
  def('string?', 1, 1, ([a]) => typeof a === 'string')
  def('symbol?', 1, 1, ([a]) => a instanceof Sym)
  def('boolean?', 1, 1, ([a]) => typeof a === 'boolean')
  def('procedure?', 1, 1, ([a]) => a instanceof Closure || a instanceof Builtin)
  def('zero?', 1, 1, ([a]) => num(a, 'zero?') === 0)
  def('even?', 1, 1, ([a]) => int(a, 'even?') % 2 === 0)
  def('odd?', 1, 1, ([a]) => int(a, 'odd?') % 2 !== 0)

  // Lists
  def('cons', 2, 2, ([a, b]) => [a, ...list(b, 'cons')])
  def('car', 1, 1, ([a]) => {
    const l = list(a, 'car')
    if (l.length === 0) throw new LispError('car: expected a non-empty list, got ()')
    return l[0]
  })
  def('cdr', 1, 1, ([a]) => {
    const l = list(a, 'cdr')
    if (l.length === 0) throw new LispError('cdr: expected a non-empty list, got ()')
    return l.slice(1)
  })
  def('list', 0, Infinity, (args) => args)
  def('length', 1, 1, ([a]) => list(a, 'length').length)
  def('append', 0, Infinity, (args) => args.flatMap((a) => list(a, 'append')))
  def('reverse', 1, 1, ([a]) => [...list(a, 'reverse')].reverse())
  def('list-ref', 2, 2, ([l, i]) => {
    const xs = list(l, 'list-ref')
    const k = int(i, 'list-ref')
    if (k < 0 || k >= xs.length) throw new LispError(`list-ref: index ${k} out of range`)
    return xs[k]
  })
  def('member', 2, 2, ([x, l]) => {
    const xs = list(l, 'member')
    const i = xs.findIndex((y) => equal(x, y))
    return i === -1 ? false : xs.slice(i)
  })
  def('map', 2, Infinity, ([f, ...lists]) => {
    const ls = lists.map((l) => list(l, 'map'))
    const n = Math.min(...ls.map((l) => l.length))
    const out: Value[] = []
    for (let i = 0; i < n; i++) out.push(call(f, ls.map((l) => l[i])))
    return out
  })
  def('for-each', 2, 2, ([f, l]) => {
    for (const x of list(l, 'for-each')) call(f, [x])
    return undefined
  })
  def('filter', 2, 2, ([f, l]) => list(l, 'filter').filter((x) => call(f, [x]) !== false))
  def('reduce', 3, 3, ([f, init, l]) => list(l, 'reduce').reduce((acc, x) => call(f, [acc, x]), init))
  def('apply', 2, 2, ([f, l]) => call(f, list(l, 'apply')))
  def('range', 1, 2, (args) => {
    const [lo, hi] = args.length === 1 ? [0, int(args[0], 'range')] : [int(args[0], 'range'), int(args[1], 'range')]
    return Array.from({ length: Math.max(0, hi - lo) }, (_, i) => lo + i)
  })

  // Strings & symbols
  def('string-append', 0, Infinity, (args) => args.map((a) => str(a, 'string-append')).join(''))
  def('string-length', 1, 1, ([a]) => str(a, 'string-length').length)
  def('string-upcase', 1, 1, ([a]) => str(a, 'string-upcase').toUpperCase())
  def('string-downcase', 1, 1, ([a]) => str(a, 'string-downcase').toLowerCase())
  def('substring', 2, 3, ([s, a, b]) => {
    const text = str(s, 'substring')
    return text.slice(int(a, 'substring'), b === undefined ? text.length : int(b, 'substring'))
  })
  def('string=?', 2, 2, ([a, b]) => str(a, 'string=?') === str(b, 'string=?'))
  def('string->number', 1, 1, ([a]) => {
    const n = Number(str(a, 'string->number'))
    return str(a, 'string->number').trim() !== '' && !Number.isNaN(n) ? n : false
  })
  def('number->string', 1, 1, ([a]) => String(num(a, 'number->string')))
  def('string->symbol', 1, 1, ([a]) => Sym.for(str(a, 'string->symbol')))
  def('symbol->string', 1, 1, ([a]) => {
    if (!(a instanceof Sym)) throw new LispError(`symbol->string: expected a symbol, got ${print(a)}`)
    return a.name
  })

  // Output & errors
  def('display', 1, 1, ([a]) => {
    output(print(a, true))
    return undefined
  })
  def('newline', 0, 0, () => {
    output('\n')
    return undefined
  })
  def('error', 1, Infinity, ([msg, ...rest]) => {
    throw new LispError([print(msg, true), ...rest.map((r) => print(r))].join(' '))
  })

  return env
}
