# Sprig — plan

A tiny Scheme-flavored Lisp with lexical closures, proper tail calls, and a
browser REPL that renders the environment chain as nested cards.

## Goal

Build a small, from-scratch interpreter that is honest about how Scheme works:
environments are real objects, closures capture the frame they were created in,
and tail calls run in constant stack space. Then make that machinery visible in
a REPL: every closure can be inspected as a chain of frames.

## Features

- Reader: atoms, numbers, strings (with escapes), `'quote`, lists, `;` comments,
  position-tagged parse errors (line:col).
- Special forms: `define` (both forms), `lambda`, `if`, `cond` (+ `else`), `let`,
  `let*`, `begin`, `set!`, `quote`, `and`, `or`.
- Proper tail calls via a trampolined `evaluate(expr, env)` loop.
- Builtins: arithmetic, comparison, list ops (`cons car cdr list length map
  filter reduce append ...`), predicates, `display`, string ops.
- REPL: history (up/down), multi-line input balanced by the reader, inline
  errors, notebook-style scroll with leaf prompt glyphs.
- Inspector: nested frame cards for the last evaluated closure; click any
  `#<procedure>` value to focus it; recent closures as chips.
- Pretty-printer: nested lists, `#<procedure name>`, `#t`/`#f`, quoted strings.
- Loadable examples: factorial, fibonacci, Y-combinator, closure counter, quicksort.

## Architecture

```
src/lisp/
  types.ts      Sym (interned), Closure, Builtin, Env, LispError/ParseError
  reader.ts     scanner -> tokens -> nested arrays / Sym objects
  eval.ts       trampolined evaluate(); special forms handled inline
  builtins.ts   host functions installed on the global frame
  printer.ts    print(value) -> string
  inspector.ts  Closure -> FrameNode tree for rendering
  examples.ts   named example programs
  index.ts      Interpreter + evalString/print convenience API
src/components/
  Repl.tsx      cells, input, history, balance-aware Enter
  Inspector.tsx nested frame cards
  Examples.tsx  example chips
src/App.tsx     layout (REPL left, inspector right; stacks on narrow screens)
```

Values: number | string | boolean | Sym | Value[] (lists) | Closure | Builtin
| undefined (void). Environments: `{ vars: Map, parent, label }`.

## Milestones

1. Plan, license, git init.
2. Vite + React + Tailwind scaffold.
3. Core: reader, evaluator, builtins, printer + vitest suite.
4. REPL UI with history, multi-line, errors.
5. Inspector with nested frame cards + examples.
6. Build, smoke test, screenshot, README, publish.
