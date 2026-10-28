# Syntax

A block is XML-like tags inside a fenced code block. This page is the grammar, including how the compiler reads text that is still arriving.

## The fence

````md
The build is green.

```ui
<Summary tone="success">All 42 tests passed</Summary>
```

Want the slow ones?
````

A fence opens with three or more backticks or tildes, indented at most three spaces, followed by the fence language and nothing else. It closes with at least as many of the same character and nothing after. The language is `ui` unless the host [chose another](/intelligent-ui/guide/getting-started#tell-the-agent). A UI fence inside another code fence is code. An unclosed fence is a block still streaming. Prose outside the fences stays Markdown.

## Declarations

```ui
$selected = ["links", "preload"]
$limit = 20
$filters = {
  "failed": true,
  "branch": "main"
}
<Summary>Showing {$limit} runs</Summary>
```

Declarations come first, one per line, before the first tag. A name is `$` followed by a letter or an underscore. The value is literal JSON: a string, a number, a boolean, `null`, an array or a record, spanning lines while a bracket is open. A non-literal value gets `invalid_default`, and a second declaration of one name `duplicate_declaration`.

The only other declaration is a live query, `$runs = @Query("ci.runs", {branch: "main"})`. See [live queries](/intelligent-ui/host/queries).

## Tags

```ui
<Callout tone="warning" title="Flaky">The login test failed twice.</Callout>
<Stats><Stat label="Tests" value={42}/></Stats>
```

A tag is `<Name props>children</Name>`, or `<Name props/>` without children. A name starts with a letter and holds letters and digits. A closing tag closes the nearest open tag of its name and everything opened inside it, and those inner tags get `unclosed_tag`. A closing tag without an open tag of its name gets `unmatched_tag`.

Some components belong inside another: a `Stat` inside `Stats`, an `Item` inside `Checklist`. A child outside its parent gets `invalid_parent`, and a container refuses a child it does not hold with `invalid_child`. `Show` and `Each` may stand anywhere and pass their parent on, so an `Each` inside a `Checklist` may repeat `Item`s. Each component page lists its rule.

## Props

```ui
<Stats><Stat label="Coverage" value={87.5} unit="%" tone="success"/></Stats>
<Choices><Choice primary={true} context='Run the "slow" suite'>Run it</Choice></Choices>
```

A prop is `name="text"`, `name='text'` or `name={expression}`. A name on its own is `true`, as in JSX: `<Choice primary>` reads as `primary={true}`. Quote strings. Put numbers, booleans, arrays, records and expressions in braces. Inside quotes a backslash escapes as in JSON: `\"`, `\'`, `\\`, `\/`, `\n`, `\t`, `\r`, `\b`, `\f` and `\uXXXX`.

A constant braced value becomes a static prop. A value that reads a variable stays an expression, evaluated against state when the block draws. The compiler checks every prop against the component's schema: constants at once, expressions with the block's defaults.

An unknown prop is dropped with `refused_prop`, and the rest of the node still draws. A component may list likely misspellings as `aliases` in the catalog (`time` on an `Event` for `at`). The compiler reads an alias as the real prop and warns with `renamed_prop`, unless the real prop is written too. A prop written twice gets `duplicate_prop`. A value that fails the schema marks the node `invalid_props`, and the node draws as its fallback.

## Text

```ui
$found = ["links", "preload", "cache"]
$fixed = ["links"]
<Summary>Fixed {@Count($fixed)} of {@Count($found)} findings</Summary>
```

Text between tags is a text node. A `{expression}` in text must give a string, a number, a boolean or `null`, written as text. Whitespace that holds only a line break is dropped, so tags may stand on lines of their own. A renderer writes text as inline Markdown at most; [agents-react](/agents-react/chat/intelligent-ui) allows emphasis, inline code and links.

## CodeBlock

```ui
<CodeBlock language="ts">
const empty = <T,>(items: T[]) => items.length === 0 && {} !== null;
</CodeBlock>
```

Everything between `<CodeBlock>` and `</CodeBlock>` is literal text: angle brackets, braces and `$` included. A CodeBlock cannot hold another tag, and its contents are never evaluated.

## While it streams

The compiler runs on every preview, so it reads text that stops anywhere.

- An open tag is an incomplete node, drawn with what it has. A control is not interactive until its tag closes.
- An unclosed quoted prop holds the text received so far.
- A half-written prop, name or expression waits for more text without a diagnostic.
- An unreadable prop is reported and skipped up to the next space or the end of its tag. The tag still opens and closes, and its children and neighbors still draw; the node itself draws as its fallback. A tag that lost a prop and never closes ends at its own `>`.
- Other malformed input is reported, and parsing resumes at the next tag or line, so one mistake costs one line.
- An unknown component shows its text fallback, and its neighbors still draw.

Once the reply is final, anything still open is reported: `unclosed_tag` for a tag, `incomplete_expression` for an expression.

## Diagnostics

Every problem becomes a `UiDiagnostic` with a `code`, a `message`, a source range and, where it has one, the node id. A block keeps at most `UI_LIMITS.diagnostics` of them.

| Code                                         | Cause                                                        |
| -------------------------------------------- | ------------------------------------------------------------ |
| `invalid_syntax`, `invalid_tag`, `invalid_prop` | A character where a tag, a prop name or a value was expected |
| `invalid_declaration`, `duplicate_declaration`, `invalid_default` | A declaration that is malformed, repeated or not a literal |
| `unclosed_tag`, `unmatched_tag`              | Tags that do not pair                                        |
| `duplicate_prop`, `refused_prop`, `invalid_props` | A prop written twice, unknown, or failing its schema    |
| `renamed_prop`                               | A prop written under an alias from the catalog, read as the real prop |
| `too_many_series`                            | A Chart with more numeric series than a drawing holds; the rest stay in its values |
| `unknown_component`                          | A name outside the catalog                                   |
| `invalid_parent`, `invalid_child`            | A component in the wrong place                               |
| `invalid_expression`, `incomplete_expression`, `invalid_value` | An expression that does not parse or evaluate |
| `refused_call`, `refused_access`             | An unknown helper, or a forbidden or inherited field         |
| `query_only`, `action_only`                  | `@Query` outside a declaration, or `@Set`/`@Reset` as a value |
| `invalid_query`, `unknown_query`             | A query the host did not register or does not accept         |
| `refused_action`, `refused_binding`          | A Button action or a binding on something other than local state |
| `budget_exceeded`                            | The block or the reply ran out of budget                     |
