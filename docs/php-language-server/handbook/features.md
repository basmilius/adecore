# PHP features and editing behavior

The server reads PHP 8.1 through 8.5 and analyzes source without executing it. Features depend on project indexing, Composer metadata, stubs and the type information available at a cursor. Unsupported dynamic behavior usually becomes `mixed`, so missing completion is preferable to an invented member.

## Navigation and completion

Hover shows resolved names, signatures and PHPDoc. Definition, type definition and implementation navigate declarations and class hierarchies, including installed packages and stubs. Document symbols, folding and selection ranges work from the open tree. Workspace symbols search projects, packages and stubs, deduplicating shared package/library names across projects.

Completion covers variables, members, classes, functions, constants, enum cases, named arguments, imports, attributes, keywords and overridable methods. Member visibility follows the surrounding class and inferred receiver. Completion can add a sorted `use` import with `additionalTextEdits`; resolve adds documentation. It does not insert call-parenthesis snippets. The host should apply both the primary edit and additional edits.

At most 300 items are returned and `isIncomplete` reports truncation. With no prefix, the list is limited to variables, keywords and members. Ordinary comments, strings and inline HTML have no generic PHP completion, although recognized framework/test string contexts have specialized support.

The type layer follows declared and documented generics, arrays/shapes, flow narrowing, closure arguments, return bodies and assert tags. It stops at variable variables, unknown dynamic members, fixed-point loop analysis and unsupported PHPDoc aliases/type-level functions. A return body is followed across files at most three bodies deep.

## References and rename

References and highlights resolve symbols through the same index/type layer as navigation. The server narrows candidate project files with a word index, then resolves actual occurrences; it does not keep a persistent resolved reference database. Open text wins over disk. Installed package usages, ordinary strings and ordinary comments are not searched as full rename targets.

Call `prepareRename` first. It rejects keywords, unknown symbols, magic methods and names declared in packages or stubs. Rename validates the new name and checks conflicts. Methods and properties follow hierarchy relationships; promoted parameters also update property and named-argument uses. PHPDoc symbol references can change. Aliases remain aliases when their imported declaration changes.

A class can also rename its file when it is the only class, the basename agrees and Composer's autoload map supports that location. The client must announce `documentChanges` and rename resource-operation support to receive that file operation. Namespace rename changes the exact namespace and matching uses, but leaves subnamespaces, relative names and Composer autoload configuration alone.

Apply the complete returned workspace edit through the host. Preserve failed-request messages for name conflicts and unsafe refactors. Every rename logs that ordinary strings/comments are unchanged; audit reflection, serialized names and host configuration separately.

## Diagnostics and fixes

Findings combine syntax recovery, language-level checks and inspections for undefined/unused names, argument/type/return problems and selected control-flow issues. Each inspection has its own code/default severity; [configuration](/php-language-server/handbook/configuration) can override it.

Quick fixes and source actions include import handling and applicable inspection corrections. Refactors include extract/inline operations, move class, change signature, hierarchy moves and rewrite intentions. Applicable actions appear at the cursor or selection; the server does not offer every refactor everywhere.

Expensive refactors use `codeAction/resolve` when supported, where an unsafe operation returns an error explaining the refusal. Clients without resolve receive immediate edits only for successful actions. Cross-file edits can include `documentChanges` and resource operations. The server reformats changed lines and returns small edits rather than replacing every file.

Change-signature coverage depends on resolvable calls. Dynamic receivers, callable strings/arrays and declarations in vendor are limits. Introducing an interface/type from a class and a rename namespace-move preview remain unfinished. A host should provide workspace-edit review appropriate to its own product rather than promise that every runtime use has been found.

## Formatting

Full and range formatting preserve tokens, validate the result and are idempotent. The formatter follows PER-style defaults with configurable braces, alignment and wrapping. It does not add tokens such as trailing commas or rewrite comments/strings. Range formatting computes whole-file layout but returns edits for the requested lines.

Full formatting returns `null` for syntax errors or markup surrounding PHP, and for an unavailable open document. On-type formatting at newline, `}` and `;` can indent unfinished code. A `null` full-format result should not be reported as a transport error. [Configuration](/php-language-server/handbook/configuration#formatting-settings) explains precedence with EditorConfig.

## Other requests

The initialize response advertises signature help, call/type hierarchies, semantic tokens for full/range requests and parameter/closure inlay hints. Signature help handles named and variadic arguments. Semantic tokens use the negotiated legend; use the actual initialize response instead of hardcoding token indices. Folding and document-symbol hierarchy also depend on client capabilities.

The retained [native workspace guide](https://github.com/basmilius/adecore/blob/main/packages/php-language-server/NATIVE.md) records detailed feature cases and the remaining roadmap. The server is not a PHP interpreter or a replacement for running a project's own tests/static analysis.
