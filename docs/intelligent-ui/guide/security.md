# Security model

A block is text an agent wrote. The agent may be wrong, and the text may carry instructions it picked up from a file or a web page. So the package treats every block as untrusted input. This page lists what a block can do, what it cannot, and what the host must still check.

## What a block can do

- Draw components from the catalog with props that pass their zod schema.
- Declare local state with literal JSON defaults, and bind it to visible controls.
- Compute text and props with the [expression language](/intelligent-ui/language/expressions).
- Set or reset its own local state from a Button.
- Declare a read of a source the host registered, with arguments that match the host's schema.
- Name a file, a diff, a commit or a node for the host to check.
- Offer Choices, each of which sends one visible message once.

## What a block cannot do

- Run code. There is no JavaScript, no function call besides the fixed helpers, no assignment and no loop besides `@Filter` and `Each`.
- Reach the network. No component takes an address it loads. A Source is opened only by the host, after a person clicked it, and only for `http` or `https`.
- Read a file. File, Diff, Commit and Node are names the host checks; Image takes only an attachment id of the chat or `generated="latest"`, never a URL or a path.
- Style anything. Unknown props are refused with `refused_prop` and dropped. No prop takes a class, a color or a size.
- Reach prototypes or accessors. `__proto__`, `constructor` and `prototype` are refused anywhere a key is read or written (`safeKey`). Only own data fields are read.
- Change anything outside itself. State lives in the page and resets when it reloads.
- Send a message without a person. Only a click on an enabled Choice sends, and only once per block.

## Budgets

Every step of work is counted, so a block cannot hang the backend or the page. `UiBudget` counts parser steps, nodes, nesting, iterations, string length and elapsed time against `UI_LIMITS`, inside helpers as well as in ordinary evaluation. `Each` reserves all its iterations before it allocates a child. A reply is also capped as a whole by `UI_REPLY_LIMITS`, and the host's reads per block by `UI_HOST_LIMITS`. The numbers are on [Compilation and streaming](/intelligent-ui/host/compilation#limits).

A block that exceeds its budget is replaced by its text and one `budget_exceeded` diagnosis. A part that fails alone keeps its own fallback; the parts beside it still draw.

## Values that cross in

The interpreter never touches a host object. `copyUiValue` copies every value that enters it: state defaults, query results, submitted input and the variables of `evaluateUiExpression`. It accepts finite JSON only and refuses class instances, accessors, sparse arrays, cycles and non-finite numbers, without calling a getter. Numbers that an expression produces must stay finite too.

## Inputs and choices

A choice sends what a person could see, and nothing else.

- A control changes state only through its binding, only after its own tag closed, and only with a value its schema accepts. A read-only control (a prop that is not a bare reference to a local variable) has no binding.
- `resolveUiChoice` runs on the backend, over the stored block, never over what the client says the block is. The client sends only identities and the values of declared inputs.
- A submitted value must equal its default, be held by a visible complete control within the options it offers, or be the exact value a visible enabled Button sets. Anything else is refused with `invalid_value`.
- A hidden, disabled or unfinished Choice cannot be sent. Neither can a block that is still streaming.
- The message is the Choice's evaluated `context`, or its label without one. Both were on screen.

## Actions

A Button holds one action: `@Set($name, literal)`, `@Reset($name)` or `@Reset()`. The compiler refuses anything else, and refuses a `@Set` whose value is not a constant. That keeps a pressed Button's result independent of the state it was pressed in, so the backend can check it. An action changes local state only. It never reads a query, sends a choice or calls the host.

## Live queries

- The source of `@Query` is a literal, and the host's registered schema must accept the arguments, or the block does not compile.
- Arguments may read only declared local state. A query result can never choose a source or another query's arguments.
- The backend captures the writing chat's access once per reply and keeps it on the backend. A client never sees it and cannot replace it. A fork captures its own chat's rights.
- Every read authorizes again against that captured access and the chat's current rights, including a read the cache answers.
- A choice in a block with queries needs a fresh read id for every query. The backend uses the values it issued, never values the client sends.

## Links

The agent names a target; the host decides. `uiLinkTargets` lists only targets of visible, complete nodes. The host checks each against the writer's captured access and its current scope, answers a chip or plain text, and checks the stored node again when a person opens it. A client never sends a free target: it names a node, and the backend reads the target from the stored block.

## What the host still owns

- Which sources exist, their argument and result schemas, and who may read them.
- Whether a path, a commit or a node is inside the scope of the chat.
- How a Source address opens, and that a page never preloads it.
- Which clients may send `chat.uiChoice`, `ui.query` and `ui.link`. The agent host answers them only for a client attached to the chat.
