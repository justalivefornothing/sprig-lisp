/** Runtime value model for Sprig. Lists are plain arrays; `undefined` is void. */
export type Value =
  | number
  | string
  | boolean
  | Sym
  | Value[]
  | Closure
  | Builtin
  | undefined

/** Interned symbol: two symbols with the same name are the same object. */
export class Sym {
  private static table = new Map<string, Sym>()
  readonly name: string
  private constructor(name: string) {
    this.name = name
  }
  static for(name: string): Sym {
    let s = Sym.table.get(name)
    if (!s) {
      s = new Sym(name)
      Sym.table.set(name, s)
    }
    return s
  }
}

/** A lexical environment frame. `label` is only used by the inspector. */
export class Env {
  readonly vars = new Map<string, Value>()
  readonly parent: Env | null
  readonly label: string

  constructor(parent: Env | null = null, label = 'global') {
    this.parent = parent
    this.label = label
  }

  define(name: string, value: Value): void {
    this.vars.set(name, value)
  }

  /** Walks the chain to find the frame that owns `name`, or null. */
  frameOf(name: string): Env | null {
    let e: Env | null = this as Env
    while (e) {
      if (e.vars.has(name)) return e
      e = e.parent
    }
    return null
  }

  lookup(name: string): Value {
    let e: Env | null = this as Env
    while (e) {
      const v = e.vars.get(name)
      if (v !== undefined || e.vars.has(name)) return v
      e = e.parent
    }
    throw new LispError(`unbound variable: ${name}`)
  }

  set(name: string, value: Value): void {
    const frame = this.frameOf(name)
    if (!frame) throw new LispError(`set!: cannot set undefined variable ${name}`)
    frame.vars.set(name, value)
  }
}

/** A user-defined procedure: parameters, body and the environment it closed over. */
export class Closure {
  readonly params: string[]
  readonly rest: string | null
  readonly body: Value[]
  readonly env: Env
  name: string | null

  constructor(params: string[], rest: string | null, body: Value[], env: Env, name: string | null = null) {
    this.params = params
    this.rest = rest
    this.body = body
    this.env = env
    this.name = name
  }
}

/** A host (JavaScript) procedure installed on the global frame. */
export class Builtin {
  readonly name: string
  readonly fn: (args: Value[]) => Value

  constructor(name: string, fn: (args: Value[]) => Value) {
    this.name = name
    this.fn = fn
  }
}

export class LispError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LispError'
  }
}

/** Reader error carrying the 1-based line/column where things went wrong. */
export class ParseError extends LispError {
  readonly line: number
  readonly col: number
  /** True when the input simply ended too early (used by the REPL for multi-line input). */
  readonly incomplete: boolean

  constructor(message: string, line: number, col: number, incomplete = false) {
    super(`${message} at ${line}:${col}`)
    this.name = 'ParseError'
    this.line = line
    this.col = col
    this.incomplete = incomplete
  }
}

export const isList = (v: Value): v is Value[] => Array.isArray(v)
export const isTruthy = (v: Value): boolean => v !== false
