import { Builtin, Closure, Env, LispError, Sym, isList, isTruthy, type Value } from './types'
import { print } from './printer'

export interface EvalHooks {
  /** Called every time a user-defined closure is applied. */
  onApply?: (closure: Closure) => void
}

const S = {
  quote: Sym.for('quote'),
  else: Sym.for('else'),
  dot: Sym.for('.'),
}

const symName = (v: Value, form: string): string => {
  if (v instanceof Sym) return v.name
  throw new LispError(`${form}: expected a symbol, got ${print(v)}`)
}

const arity = (form: Value[], min: number, max = min): void => {
  const n = form.length - 1
  if (n < min || n > max) {
    const want = min === max ? `${min}` : max === Infinity ? `at least ${min}` : `${min} to ${max}`
    throw new LispError(`${print(form[0])}: expected ${want} argument${min === 1 && max === 1 ? '' : 's'}, got ${n}`)
  }
}

/** Splits a lambda parameter list into fixed params and an optional rest param. */
function parseParams(spec: Value, form: string): { params: string[]; rest: string | null } {
  if (spec instanceof Sym) return { params: [], rest: spec.name }
  if (!isList(spec)) throw new LispError(`${form}: bad parameter list ${print(spec)}`)
  const params: string[] = []
  for (let i = 0; i < spec.length; i++) {
    if (spec[i] === S.dot) {
      if (i !== spec.length - 2) throw new LispError(`${form}: bad rest parameter`)
      return { params, rest: symName(spec[i + 1], form) }
    }
    params.push(symName(spec[i], form))
  }
  return { params, rest: null }
}

function makeClosure(spec: Value, body: Value[], env: Env, form: string): Closure {
  if (body.length === 0) throw new LispError(`${form}: empty body`)
  const { params, rest } = parseParams(spec, form)
  return new Closure(params, rest, body, env)
}

/** Binds arguments into a fresh frame whose parent is the closure's captured env. */
function bindArgs(proc: Closure, args: Value[]): Env {
  const n = proc.params.length
  if (args.length < n || (proc.rest === null && args.length > n)) {
    const want = proc.rest === null ? `${n}` : `at least ${n}`
    throw new LispError(
      `${proc.name ?? 'lambda'}: expected ${want} argument${n === 1 && proc.rest === null ? '' : 's'}, got ${args.length}`,
    )
  }
  const frame = new Env(proc.env, proc.name ?? 'λ')
  for (let i = 0; i < n; i++) frame.define(proc.params[i], args[i])
  if (proc.rest !== null) frame.define(proc.rest, args.slice(n))
  return frame
}

/** Evaluates all but the last body form and returns the last one for the trampoline. */
function tail(body: Value[], env: Env, hooks: EvalHooks, form: string): Value {
  if (body.length === 0) throw new LispError(`${form}: empty body`)
  for (let i = 0; i < body.length - 1; i++) evaluate(body[i], env, hooks)
  return body[body.length - 1]
}

/**
 * Trampolined evaluator. Special forms are handled inline; anything in tail
 * position (last expression of if/cond/begin/let/and/or/lambda bodies, and
 * every procedure call) reassigns `x`/`env` and loops instead of recursing,
 * so tail-recursive Sprig programs run in constant JS stack depth.
 */
export function evaluate(x: Value, env: Env, hooks: EvalHooks = {}): Value {
  for (;;) {
    if (x instanceof Sym) return env.lookup(x.name)
    if (!isList(x)) return x // numbers, strings, booleans, procedures self-evaluate
    if (x.length === 0) throw new LispError('cannot evaluate the empty list ()')

    const head = x[0]

    if (head instanceof Sym) {
      switch (head.name) {
        case 'quote':
          arity(x, 1)
          return x[1]

        case 'if': {
          arity(x, 2, 3)
          if (isTruthy(evaluate(x[1], env, hooks))) x = x[2]
          else if (x.length === 4) x = x[3]
          else return undefined
          continue
        }

        case 'define': {
          arity(x, 1, Infinity)
          const target = x[1]
          if (isList(target)) {
            // (define (name . params) body...)
            if (target.length === 0) throw new LispError('define: missing procedure name')
            const name = symName(target[0], 'define')
            const proc = makeClosure(target.slice(1), x.slice(2), env, 'define')
            proc.name = name
            env.define(name, proc)
            return undefined
          }
          arity(x, 1, 2)
          const name = symName(target, 'define')
          const value = x.length === 3 ? evaluate(x[2], env, hooks) : undefined
          if (value instanceof Closure && value.name === null) value.name = name
          env.define(name, value)
          return undefined
        }

        case 'set!': {
          arity(x, 2)
          env.set(symName(x[1], 'set!'), evaluate(x[2], env, hooks))
          return undefined
        }

        case 'lambda':
          arity(x, 2, Infinity)
          return makeClosure(x[1], x.slice(2), env, 'lambda')

        case 'begin':
          if (x.length === 1) return undefined
          x = tail(x.slice(1), env, hooks, 'begin')
          continue

        case 'let':
        case 'let*': {
          arity(x, 2, Infinity)
          const bindings = x[1]
          if (!isList(bindings)) throw new LispError(`${head.name}: expected a binding list`)
          const frame = new Env(env, head.name)
          for (const b of bindings) {
            if (!isList(b) || b.length !== 2) {
              throw new LispError(`${head.name}: bad binding ${print(b)}, expected (name value)`)
            }
            // let evaluates inits in the outer env; let* sees earlier bindings.
            frame.define(symName(b[0], head.name), evaluate(b[1], head.name === 'let' ? env : frame, hooks))
          }
          env = frame
          x = tail(x.slice(2), env, hooks, head.name)
          continue
        }

        case 'cond': {
          let chosen: Value[] | null = null
          for (const clause of x.slice(1)) {
            if (!isList(clause) || clause.length === 0) {
              throw new LispError(`cond: bad clause ${print(clause)}`)
            }
            if (clause[0] === S.else) {
              chosen = clause.slice(1)
              break
            }
            const test = evaluate(clause[0], env, hooks)
            if (isTruthy(test)) {
              if (clause.length === 1) return test
              chosen = clause.slice(1)
              break
            }
          }
          if (chosen === null) return undefined
          x = tail(chosen, env, hooks, 'cond')
          continue
        }

        case 'and': {
          if (x.length === 1) return true
          let short = false
          for (let i = 1; i < x.length - 1; i++) {
            const v = evaluate(x[i], env, hooks)
            if (!isTruthy(v)) {
              short = true
              break
            }
          }
          if (short) return false
          x = x[x.length - 1]
          continue
        }

        case 'or': {
          if (x.length === 1) return false
          let found: Value = false
          let hit = false
          for (let i = 1; i < x.length - 1; i++) {
            const v = evaluate(x[i], env, hooks)
            if (isTruthy(v)) {
              found = v
              hit = true
              break
            }
          }
          if (hit) return found
          x = x[x.length - 1]
          continue
        }
      }
    }

    // Procedure application.
    const proc = evaluate(head, env, hooks)
    const args: Value[] = []
    for (let i = 1; i < x.length; i++) args.push(evaluate(x[i], env, hooks))

    if (proc instanceof Builtin) return proc.fn(args)
    if (proc instanceof Closure) {
      hooks.onApply?.(proc)
      env = bindArgs(proc, args)
      x = tail(proc.body, env, hooks, proc.name ?? 'lambda')
      continue
    }
    throw new LispError(`not a procedure: ${print(proc)}`)
  }
}

/** Applies a procedure from host code (used by map/filter/reduce/apply). */
export function apply(proc: Value, args: Value[], hooks: EvalHooks = {}): Value {
  if (proc instanceof Builtin) return proc.fn(args)
  if (proc instanceof Closure) {
    hooks.onApply?.(proc)
    const frame = bindArgs(proc, args)
    return evaluate([Sym.for('begin'), ...proc.body], frame, hooks)
  }
  throw new LispError(`not a procedure: ${print(proc)}`)
}
