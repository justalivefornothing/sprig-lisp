export interface Example {
  name: string
  blurb: string
  /** Each entry becomes one REPL cell, evaluated in order. */
  cells: string[]
}

export const examples: Example[] = [
  {
    name: 'closure counter',
    blurb: 'Two counters, two private frames.',
    cells: [
      `(define make-counter
  (lambda ()
    (let ((n 0))
      (lambda () (set! n (+ n 1)) n))))`,
      '(define c1 (make-counter))',
      '(define c2 (make-counter))',
      '(c1)',
      '(c1)',
      '(c1)',
      '(c2)',
    ],
  },
  {
    name: 'factorial',
    blurb: 'Accumulator style, so the recursion is a tail call.',
    cells: [
      `(define (factorial n)
  (define (go n acc)
    (if (= n 0) acc (go (- n 1) (* acc n))))
  (go n 1))`,
      '(factorial 10)',
      '(map factorial (range 1 8))',
    ],
  },
  {
    name: 'fibonacci',
    blurb: 'Iterative fib with let* and a 100000-deep tail loop.',
    cells: [
      `(define (fib n)
  (let* ((step (lambda (a b k)
                 (if (= k 0) a (step b (+ a b) (- k 1))))))
    (step 0 1 n)))`,
      '(map fib (range 12))',
      '(define (count-down n) (if (= n 0) "landed" (count-down (- n 1))))',
      '(count-down 100000)',
    ],
  },
  {
    name: 'Y-combinator',
    blurb: 'Recursion without define, via self-application.',
    cells: [
      `(define Y
  (lambda (f)
    ((lambda (x) (f (lambda (v) ((x x) v))))
     (lambda (x) (f (lambda (v) ((x x) v)))))))`,
      `(define fact
  (Y (lambda (self)
       (lambda (n) (if (= n 0) 1 (* n (self (- n 1))))))))`,
      '(fact 6)',
    ],
  },
  {
    name: 'quicksort',
    blurb: 'filter + append on plain lists.',
    cells: [
      `(define (quicksort xs)
  (cond ((null? xs) '())
        (else
         (let ((pivot (car xs)) (rest (cdr xs)))
           (append (quicksort (filter (lambda (x) (< x pivot)) rest))
                   (list pivot)
                   (quicksort (filter (lambda (x) (>= x pivot)) rest)))))))`,
      "(quicksort '(3 1 4 1 5 9 2 6 5 3 5))",
    ],
  },
]
