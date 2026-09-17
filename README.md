# Sprig Lisp

A tiny Scheme-flavored Lisp with lexical closures, proper tail calls, and a browser REPL that renders the environment chain as nested cards.

## Why

Most toy Lisps hide the environment model. This one makes it visible: every closure can be inspected as a chain of frames, and tail calls really do run in constant stack space via a trampoline.

## Features

- Reader: atoms, numbers, strings, quotes, lists, comments, line:col errors
- Special forms: `define`, `lambda`, `if`, `cond`, `let`, `let*`, `begin`, `set!`, `quote`, `and`, `or`
- Proper tail calls (trampolined evaluator)
- Builtins for arithmetic, lists, predicates, strings, `display`
- REPL with history, multi-line input, inline errors
- Inspector: nested frame cards for closures
- Examples: factorial, fibonacci, Y-combinator, closure counter, quicksort

## Status

See `PLAN.md` for architecture and remaining milestones. Core interpreter + REPL scaffolding are in place.

## License

MIT
