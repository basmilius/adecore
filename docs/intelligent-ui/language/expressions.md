# Expressions

An expression stands in braces: in a prop (`value={$limit}`), in text (`{@Count($rows)}`) or as a declaration's query arguments. It computes a value from literals and state. It cannot call anything outside the fixed helpers, and every step counts against the block's [budget](/intelligent-ui/guide/security#budgets).

```ui
$runs = [{"name": "unit", "ms": 4210, "failed": false}, {"name": "e2e", "ms": 61800, "failed": true}]
<Summary>{@Count(@Filter($runs, run, run.failed))} of {@Count($runs)} suites failed</Summary>
<Stats>
<Stat label="Total time" value={@Round(@Sum($runs, "ms") / 1000, 1)} unit="s"/>
</Stats>
<Show when={@Count(@Filter($runs, run, run.failed)) > 0}>
<Callout tone="danger">Fix the failing suites first.</Callout>
</Show>
```

A declaration holds a literal, never a computation, so an expression is written where its value is used. There is no conditional operator; `Show` draws children only when its condition holds.

## Values

An expression gives a `UiValue`: `null`, a boolean, a finite number, a string, an array or a record of those. Literals are written as in JSON, with two additions: strings may use single quotes, and record keys may be bare names (`{branch: "main"}`).

## References

| Form              | Reads                                                       |
| ----------------- | ----------------------------------------------------------- |
| `$name`           | A declared variable or a query result                       |
| `row`             | The local name of an `Each` or of an `@Filter` predicate    |
| `$run.name`       | An own field of a record                                    |
| `$runs[0]`        | An item of an array, by index                               |
| `$run["ms"]`      | An own field by a computed key                              |

Only own data fields are read. An inherited field, an accessor, a missing field and the keys `__proto__`, `constructor` and `prototype` are refused with `refused_access`.

## Operators

From loosest to tightest:

| Operators                     | Meaning                                                                 |
| ----------------------------- | ----------------------------------------------------------------------- |
| `\|\|`                        | The left side if it is truthy, otherwise the right side                 |
| `&&`                          | The left side if it is falsy, otherwise the right side                  |
| `==`, `===`, `!=`, `!==`      | Strict equality of scalars; both spellings are strict                   |
| `<`, `<=`, `>`, `>=`          | Comparison of two numbers                                               |
| `+`, `-`                      | Addition and subtraction; `+` joins text when either side is a string   |
| `*`, `/`, `%`                 | Multiplication, division and remainder                                  |
| `!`, `-`, `+` (prefix)        | Not, negation and a number as is                                        |

Arithmetic and comparison take numbers only, and a result must be finite: `1 / 0` is refused. Equality compares by identity, so two arrays or records are never equal; compare their fields. Parentheses group.

## Helpers

| Helper    | Arguments                                         | Gives                                               |
| --------- | ------------------------------------------------- | --------------------------------------------------- |
| `@Count`  | A list or a string                                | Its length                                          |
| `@Filter` | A list, a local name and a boolean predicate      | The items for which the predicate is `true`         |
| `@Sum`    | A list of numbers, or a list of records and a field name | The total                                    |
| `@Join`   | A list of scalars and an optional separator (`", "`) | One string                                       |
| `@Round`  | A number and an optional precision from 0 to 6    | The rounded number                                  |

```ui
$tasks = [{"title": "Docs", "points": 3, "done": true}, {"title": "Tests", "points": 5, "done": false}]
<Summary>{@Sum(@Filter($tasks, task, !task.done), "points")} points left</Summary>
<Progress value={@Count(@Filter($tasks, task, task.done))} max={@Count($tasks)}>Tasks done</Progress>
```

The second argument of `@Filter` is a bare name, without `$`. It holds each item while the predicate runs, and the predicate must give a boolean. `@Count` of a string counts UTF-16 units.

Three more names exist, but not as values. `@Query` only stands in a [declaration](/intelligent-ui/host/queries), and `@Set` and `@Reset` only in a [Button action](/intelligent-ui/language/state#buttons). Used anywhere else they are refused with `query_only` or `action_only`. Any other `@Name` is refused with `refused_call`.

## Each

```ui
$suites = [{"name": "unit", "passed": 120}, {"name": "e2e", "passed": 18}]
<EntityList>
<Each items={$suites} as="suite">
<Entry label={suite.name}>{suite.passed} passed</Entry>
</Each>
</EntityList>
```

`Each` repeats its children for every item of `items`, which may hold at most 1,000. `as` names the item, a bare name like a `@Filter` local. Inside, the name reads like any variable. Each repetition gets its own node ids, the compiled id with `:0`, `:1` and so on added.

## From code

`parseUiExpression(source, budget?)` parses one expression into a `UiExpression` tree. `evaluateUiExpression(expression, variables?, budget?)` evaluates it against variables, copied in with `copyUiValue` first. Both throw a `UiFailure` with its `code` on refusal. `sameUiValue(first, second)` compares two values deeply, regardless of key order; the runtime uses it to tell whether state still holds its default.

```ts
import { evaluateUiExpression, parseUiExpression } from '@adecore/intelligent-ui/expression';

const total = evaluateUiExpression(parseUiExpression('@Sum($rows, "ms")'), { $rows: [{ ms: 10 }, { ms: 32 }] });
```
