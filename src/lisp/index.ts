import { makeGlobalEnv } from './builtins'
import { evaluate, type EvalHooks } from './eval'
import { read } from './reader'
import { Closure, Env, LispError, type Value } from './types'

export { print } from './printer'
export { read, isIncomplete } from './reader'
export { Builtin, Closure, Env, LispError, ParseError, Sym, type Value } from './types'

export interface RunResult {
  /** Value of the last top-level form (undefined if a form failed). */
  value: Value
  /** Everything written by `display` / `newline` during the run, even if it failed. */
  output: string
  /** The Sprig error that stopped evaluation, if any. */
  error: LispError | null
}

/** A persistent global environment plus output capture — one per REPL session. */
export class Interpreter {
  readonly global: Env
  /** The most recently applied user-defined closure. */
  lastApplied: Closure | null = null
  /** The closure most recently applied or bound by `define` — what the inspector follows. */
  lastClosure: Closure | null = null
  private buffer: string[] = []
  private readonly hooks: EvalHooks = {
    onApply: (c) => {
      this.lastApplied = c
      this.lastClosure = c
    },
    onDefine: (_name, v) => {
      if (v instanceof Closure) this.lastClosure = v
    },
  }

  constructor() {
    this.global = makeGlobalEnv((text) => this.buffer.push(text), this.hooks)
  }

  /** Reads and evaluates every form in `src`. Sprig errors are returned, not thrown. */
  run(src: string): RunResult {
    this.buffer = []
    let value: Value = undefined
    let error: LispError | null = null
    try {
      for (const form of read(src)) value = evaluate(form, this.global, this.hooks)
    } catch (e) {
      if (e instanceof LispError) error = e
      else if (e instanceof RangeError) error = new LispError('stack overflow: too deep a chain of non-tail calls')
      else throw e
    }
    return { value: error ? undefined : value, output: this.buffer.join(''), error }
  }
}

/** Convenience: evaluate `src` in a fresh interpreter, returning the last value or throwing. */
export function evalString(src: string): Value {
  const result = new Interpreter().run(src)
  if (result.error) throw result.error
  return result.value
}
