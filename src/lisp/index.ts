import { makeGlobalEnv } from './builtins'
import { evaluate, type EvalHooks } from './eval'
import { read } from './reader'
import { Closure, Env, LispError, type Value } from './types'

export { print } from './printer'
export { read, isIncomplete } from './reader'
export { Builtin, Closure, Env, LispError, ParseError, Sym, type Value } from './types'

export interface RunResult {
  /** Value of the last top-level form. */
  value: Value
  /** Everything written by `display` / `newline` during the run. */
  output: string
}

/** A persistent global environment plus output capture — one per REPL session. */
export class Interpreter {
  readonly global: Env
  /** The most recently applied user-defined closure, for the inspector. */
  lastApplied: Closure | null = null
  private buffer: string[] = []
  private readonly hooks: EvalHooks = {
    onApply: (c) => {
      this.lastApplied = c
    },
  }

  constructor() {
    this.global = makeGlobalEnv((text) => this.buffer.push(text), this.hooks)
  }

  /** Reads and evaluates every form in `src`, returning the last value. */
  run(src: string): RunResult {
    this.buffer = []
    const forms = read(src)
    let value: Value = undefined
    try {
      for (const form of forms) value = evaluate(form, this.global, this.hooks)
    } catch (e) {
      if (e instanceof RangeError) {
        throw new LispError('stack overflow: too deep a chain of non-tail calls')
      }
      throw e
    }
    return { value, output: this.buffer.join('') }
  }
}

/** Convenience: evaluate `src` in a fresh interpreter and return the last value. */
export function evalString(src: string): Value {
  return new Interpreter().run(src).value
}
