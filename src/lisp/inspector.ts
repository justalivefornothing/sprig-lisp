import { print } from './printer'
import { Builtin, Closure, Env, Sym, type Value } from './types'

export interface Binding {
  name: string
  text: string
  /** The raw value, kept so the UI can offer "focus this closure". */
  value: Value
}

export interface FrameNode {
  kind: 'global' | 'frame' | 'closure'
  label: string
  bindings: Binding[]
  /** For the global frame: how many builtins were hidden. */
  hiddenBuiltins: number
  child: FrameNode | null
}

const binding = (name: string, value: Value): Binding => ({ name, value, text: print(value) })

/** The closure's parameter list as a Sprig value, e.g. `(a b . rest)`. */
function paramList(c: Closure): Value[] {
  const params: Value[] = c.params.map((p) => Sym.for(p))
  if (c.rest) params.push(Sym.for('.'), Sym.for(c.rest))
  return params
}

/** Reconstructs the source form of a closure, e.g. `(lambda (x) (* x x))`. */
export function closureSource(c: Closure): string {
  return print([Sym.for('lambda'), paramList(c), ...c.body])
}

/**
 * Serializes the environment chain a closure captured into a tree, outermost
 * (global) first. The innermost node is the closure itself, so the UI can draw
 * global > frame > frame > #<procedure> as nested cards.
 */
export function frameChain(closure: Closure, showBuiltins = false): FrameNode {
  const frames: Env[] = []
  for (let e: Env | null = closure.env; e; e = e.parent) frames.unshift(e)

  const leaf: FrameNode = {
    kind: 'closure',
    label: print(closure),
    bindings: [binding('params', paramList(closure))],
    hiddenBuiltins: 0,
    child: null,
  }

  return frames.reduceRight<FrameNode>((child, env) => {
    const isGlobal = env.parent === null
    const bindings: Binding[] = []
    let hidden = 0
    for (const [name, value] of env.vars) {
      if (isGlobal && !showBuiltins && value instanceof Builtin) hidden++
      else bindings.push(binding(name, value))
    }
    return { kind: isGlobal ? 'global' : 'frame', label: env.label, bindings, hiddenBuiltins: hidden, child }
  }, leaf)
}
