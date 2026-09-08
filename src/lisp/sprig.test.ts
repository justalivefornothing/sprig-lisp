import { describe, expect, it } from 'vitest'
import { Interpreter, ParseError, evalString, isIncomplete, print, read } from './index'
import { closureSource, frameChain } from './inspector'
import { Closure, Sym } from './types'

// Long tail-call loops are CPU-bound; leave headroom for cold JIT on busy machines.
const LONG = 60_000

describe('spec assertions', () => {
  it('applies an immediate lambda', () => {
    expect(evalString('((lambda (x) (* x x)) 7)')).toBe(49)
  })

  it(
    'runs 200000 tail calls without blowing the stack',
    () => {
      expect(evalString('(define (loop n) (if (= n 0) "done" (loop (- n 1)))) (loop 200000)')).toBe('done')
    },
    LONG,
  )

  it('maps over a list and prints it', () => {
    expect(print(evalString('(map (lambda (x) (* x 2)) (list 1 2 3))'))).toBe('(2 4 6)')
  })

  it('closures capture and mutate their own frame', () => {
    expect(evalString('(define c (let ((n 0)) (lambda () (set! n (+ n 1)) n))) (c) (c) (c)')).toBe(3)
  })

  it('reports builtin arity errors', () => {
    expect(() => evalString('(car)')).toThrow(/car: expected 1 argument/)
  })
})

describe('reader', () => {
  it('reads atoms, numbers, strings, quote and comments', () => {
    const forms = read(`; a comment\n(a 1 -2.5 "hi\\n" 'b #t #f)`)
    expect(forms).toHaveLength(1)
    expect(print(forms[0])).toBe(`(a 1 -2.5 "hi\\n" 'b #t #f)`)
    expect((forms[0] as unknown[])[0]).toBe(Sym.for('a'))
  })

  it('tags parse errors with line and column', () => {
    expect(() => read('(define x\n  (+ 1 2)))')).toThrow(/unexpected '\)' at 2:11/)
    expect(() => read('(foo\n "bar')).toThrow(/unterminated string at 2:2/)
    expect(() => read('(a (b c)')).toThrow(/missing '\)' for '\(' opened at 1:1/)
  })

  it('distinguishes incomplete input from real errors', () => {
    expect(isIncomplete('(define (f x)')).toBe(true)
    expect(isIncomplete('"open string')).toBe(true)
    expect(isIncomplete('(+ 1 2)')).toBe(false)
    expect(isIncomplete(')')).toBe(false)
    let caught: unknown
    try {
      read('(')
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(ParseError)
    expect((caught as ParseError).incomplete).toBe(true)
  })
})

describe('special forms', () => {
  it('if, cond with else, and/or short-circuit', () => {
    expect(evalString('(if #f 1)')).toBeUndefined()
    expect(evalString('(cond ((= 1 2) "a") ((= 1 1) "b") (else "c"))')).toBe('b')
    expect(evalString('(cond (#f 1) (else 2 3))')).toBe(3)
    expect(evalString('(cond (5))')).toBe(5)
    expect(evalString('(and 1 2 3)')).toBe(3)
    expect(evalString('(and 1 #f (car (list)))')).toBe(false)
    expect(evalString('(or #f 0 (car (list)))')).toBe(0)
    expect(evalString('(and)')).toBe(true)
    expect(evalString('(or)')).toBe(false)
  })

  it('let vs let*', () => {
    expect(evalString('(let ((a 1) (b 2)) (+ a b))')).toBe(3)
    expect(evalString('(let* ((a 1) (b (+ a 1))) (* a b))')).toBe(2)
    expect(() => evalString('(let ((a 1) (b (+ a 1))) b)')).toThrow(/unbound variable: a/)
  })

  it('begin, set!, define shorthand and rest parameters', () => {
    expect(evalString('(define x 1) (begin (set! x (+ x 1)) (set! x (* x 10)) x)')).toBe(20)
    expect(() => evalString('(set! nope 1)')).toThrow(/set!: cannot set undefined variable nope/)
    expect(evalString('(define (add . xs) (apply + xs)) (add 1 2 3 4)')).toBe(10)
    expect(evalString('(define (f a . rest) rest) (f 1 2 3)')).toEqual([2, 3])
    expect(print(evalString('((lambda args args) 1 2)'))).toBe('(1 2)')
  })

  it('quote yields data, not evaluation', () => {
    expect(print(evalString("'(1 (2 3) x)"))).toBe('(1 (2 3) x)')
    expect(evalString("(car '(a b))")).toBe(Sym.for('a'))
  })

  it('names closures from define and prints procedures', () => {
    expect(print(evalString('(define (sq x) (* x x)) sq'))).toBe('#<procedure sq>')
    expect(print(evalString('(define sq (lambda (x) (* x x))) sq'))).toBe('#<procedure sq>')
    expect(print(evalString('(lambda (x) x)'))).toBe('#<procedure>')
    expect(print(evalString('car'))).toBe('#<builtin car>')
  })
})

describe('tail calls', () => {
  it(
    'handles mutual recursion and cond/let/begin tail positions',
    () => {
      const src = `
        (define (even? n) (cond ((= n 0) #t) (else (odd? (- n 1)))))
        (define (odd? n) (if (= n 0) #f (let ((m (- n 1))) (begin (even? m)))))
        (even? 100001)`
      expect(evalString(src)).toBe(false)
    },
    LONG,
  )

  it(
    'accumulator loop over a million iterations',
    () => {
      expect(evalString('(define (sum n acc) (if (= n 0) acc (sum (- n 1) (+ acc n)))) (sum 1000000 0)')).toBe(500000500000)
    },
    LONG,
  )

  it('turns deep non-tail recursion into a Sprig error', () => {
    expect(() => evalString('(define (deep n) (if (= n 0) 0 (+ 1 (deep (- n 1))))) (deep 1000000)')).toThrow(
      /stack overflow/,
    )
  })
})

describe('builtins', () => {
  it('arithmetic and comparison', () => {
    expect(evalString('(- 10 1 2)')).toBe(7)
    expect(evalString('(- 5)')).toBe(-5)
    expect(evalString('(/ 12 2 3)')).toBe(2)
    expect(() => evalString('(/ 1 0)')).toThrow(/division by zero/)
    expect(evalString('(< 1 2 3)')).toBe(true)
    expect(evalString('(< 1 3 2)')).toBe(false)
    expect(evalString('(modulo -7 3)')).toBe(2)
    expect(evalString('(remainder -7 3)')).toBe(-1)
    expect(() => evalString('(+ 1 "a")')).toThrow(/\+: expected a number, got "a"/)
  })

  it('list operations', () => {
    expect(print(evalString('(cons 1 (list 2 3))'))).toBe('(1 2 3)')
    expect(print(evalString("(append '(1 2) '(3) '())"))).toBe('(1 2 3)')
    expect(evalString("(length '(a b c))")).toBe(3)
    expect(print(evalString("(filter odd? '(1 2 3 4 5))"))).toBe('(1 3 5)')
    expect(evalString("(reduce + 0 '(1 2 3 4))")).toBe(10)
    expect(print(evalString("(reverse '(1 2 3))"))).toBe('(3 2 1)')
    expect(print(evalString("(map + '(1 2) '(10 20))"))).toBe('(11 22)')
    expect(evalString("(equal? '(1 (2)) '(1 (2)))")).toBe(true)
    expect(evalString("(eq? '() '())")).toBe(true)
    expect(() => evalString("(cdr '())")).toThrow(/cdr: expected a non-empty list/)
  })

  it('strings and display', () => {
    expect(evalString('(string-append "a" "b" "c")')).toBe('abc')
    expect(evalString('(string-upcase "sprig")')).toBe('SPRIG')
    expect(evalString('(substring "sprig" 1 3)')).toBe('pr')
    expect(evalString('(string->number "42")')).toBe(42)
    expect(evalString('(string->number "x")')).toBe(false)
    expect(evalString('(symbol->string (quote abc))')).toBe('abc')
    const interp = new Interpreter()
    const r = interp.run('(display "hi") (newline) (display (list 1 "two")) 7')
    expect(r.output).toBe('hi\n(1 two)')
    expect(r.value).toBe(7)
    expect(print('two')).toBe('"two"')
  })

  it('error and not-a-procedure', () => {
    expect(() => evalString('(error "boom" 1 2)')).toThrow(/^boom 1 2$/)
    expect(() => evalString('(5 1)')).toThrow(/not a procedure: 5/)
    expect(() => evalString('((lambda (x) x))')).toThrow(/lambda: expected 1 argument, got 0/)
    expect(() => evalString('(define (f a b) a) (f 1)')).toThrow(/f: expected 2 arguments, got 1/)
  })
})

describe('inspector', () => {
  it('serializes the frame chain of a closure counter', () => {
    const interp = new Interpreter()
    interp.run(`
      (define (make-counter) (let ((n 0)) (lambda () (set! n (+ n 1)) n)))
      (define c1 (make-counter))
      (define c2 (make-counter))
      (c1) (c1) (c1) (c2)`)
    const c1 = interp.global.lookup('c1') as Closure
    const tree = frameChain(c1)
    expect(tree.kind).toBe('global')
    expect(tree.hiddenBuiltins).toBeGreaterThan(40)
    expect(tree.bindings.map((b) => b.name)).toEqual(['make-counter', 'c1', 'c2'])
    const call = tree.child!
    expect(call.label).toBe('make-counter')
    expect(call.bindings).toEqual([])
    const letFrame = call.child!
    expect(letFrame.label).toBe('let')
    expect(letFrame.bindings).toEqual([{ name: 'n', value: 3, text: '3' }])
    expect(letFrame.child!.kind).toBe('closure')
    expect(letFrame.child!.label).toBe('#<procedure c1>')
    const c2 = interp.global.lookup('c2') as Closure
    expect(frameChain(c2).child!.child!.bindings[0].value).toBe(1)
    expect(interp.lastApplied).toBe(c2)
    expect(closureSource(c1)).toBe('(lambda () (set! n (+ n 1)) n)')
  })
})
