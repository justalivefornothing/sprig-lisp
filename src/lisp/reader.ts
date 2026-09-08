import { ParseError, Sym, type Value } from './types'

type Token =
  | { kind: '(' | ')' | "'"; line: number; col: number }
  | { kind: 'string'; text: string; line: number; col: number }
  | { kind: 'atom'; text: string; line: number; col: number }

const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/
const DELIM = new Set(['(', ')', "'", '"', ';', ' ', '\t', '\n', '\r'])
const ESCAPES: Record<string, string> = { n: '\n', t: '\t', '"': '"', '\\': '\\' }

/** Hand-written scanner: strings, comments, punctuation and bare atoms. */
export function tokenize(src: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  let line = 1
  let col = 1

  const advance = (): string => {
    const ch = src[i++]
    if (ch === '\n') {
      line++
      col = 1
    } else col++
    return ch
  }

  while (i < src.length) {
    const ch = src[i]
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      advance()
    } else if (ch === ';') {
      while (i < src.length && src[i] !== '\n') advance()
    } else if (ch === '(' || ch === ')' || ch === "'") {
      tokens.push({ kind: ch, line, col })
      advance()
    } else if (ch === '"') {
      const startLine = line
      const startCol = col
      advance()
      let text = ''
      let closed = false
      while (i < src.length) {
        const c = advance()
        if (c === '"') {
          closed = true
          break
        }
        if (c === '\\') {
          if (i >= src.length) break
          const e = advance()
          text += ESCAPES[e] ?? e
        } else text += c
      }
      if (!closed) throw new ParseError('unterminated string', startLine, startCol, true)
      tokens.push({ kind: 'string', text, line: startLine, col: startCol })
    } else {
      const startCol = col
      let text = ''
      while (i < src.length && !DELIM.has(src[i])) text += advance()
      tokens.push({ kind: 'atom', text, line, col: startCol })
    }
  }
  return tokens
}

function atom(text: string): Value {
  if (text === '#t' || text === '#true') return true
  if (text === '#f' || text === '#false') return false
  if (NUMBER.test(text)) return Number(text)
  return Sym.for(text)
}

/** Parses every top-level form in `src` into nested arrays / Sym objects. */
export function read(src: string): Value[] {
  const tokens = tokenize(src)
  let pos = 0

  const readForm = (): Value => {
    const t = tokens[pos++]
    if (!t) {
      const last = tokens[tokens.length - 1]
      throw new ParseError('unexpected end of input', last?.line ?? 1, last?.col ?? 1, true)
    }
    switch (t.kind) {
      case '(': {
        const items: Value[] = []
        for (;;) {
          const next = tokens[pos]
          if (!next) {
            throw new ParseError(
              `missing ')' for '(' opened`,
              t.line,
              t.col,
              true,
            )
          }
          if (next.kind === ')') {
            pos++
            return items
          }
          items.push(readForm())
        }
      }
      case ')':
        throw new ParseError(`unexpected ')'`, t.line, t.col)
      case "'":
        return [Sym.for('quote'), readForm()]
      case 'string':
        return t.text
      case 'atom':
        return atom(t.text)
    }
  }

  const forms: Value[] = []
  while (pos < tokens.length) forms.push(readForm())
  return forms
}

/**
 * True when `src` is syntactically incomplete (open parens / open string) and
 * the REPL should wait for more lines rather than evaluating.
 */
export function isIncomplete(src: string): boolean {
  try {
    read(src)
    return false
  } catch (e) {
    return e instanceof ParseError && e.incomplete
  }
}
