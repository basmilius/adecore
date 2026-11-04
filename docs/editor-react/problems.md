# Problems

A language server's diagnostics become problems in two places: the markers of the file in an editor, and a store of every file's problems for a problems panel.

## In a file

The `DiagnosticsFeature` (`language.diagnostics`) turns the service's diagnostics into [markers](/editor/decorations#problems). A report replaces the earlier one of the same `source`, so two servers do not erase each other. The markers fade unused code and strike through deprecated code. The [hover card](/editor-react/hover) lists the problems at the pointer. `step` and `goToFirst` [`announce`](/editor/accessibility#saying-things) the severity and message of the problem they land on.

| Member               | What it does                                                              |
| -------------------- | ------------------------------------------------------------------------- |
| `problems`           | The problems of the file, as `Problem`s                                   |
| `counts()`           | `{ error, warning, info }`                                                |
| `at(position)`       | The problems at a position                                                |
| `step(direction)`    | Puts the caret on the next or previous problem, as F2 and Alt+Shift+F2 do |
| `goToFirst()`        | Puts the caret on the first problem                                       |
| `onChange(listener)` | Called when a report changes the problems; an edit only moves them        |

`useProblemCounts(language)` reads `counts()` in a component as `ProblemCounts` and rerenders when it changes; `null` gives zeros.

```tsx
function StatusBar({ language }: { language: EditorLanguage | null }) {
    const counts = useProblemCounts(language);

    return <span>{counts.error} errors, {counts.warning} warnings</span>;
}
```

## In the project

`project.problems` is a `ProjectProblems` store of every file's problems, for a problems panel. `subscribe` and `getSnapshot` fit `useSyncExternalStore`. A `ProblemFile` has a `path` and its `rows`; a `ProblemRow` has the `diagnostic` and the `server` that reported it. Rows go worst first, then in file order, and files by path. The store leaves out hints.

```tsx
const files = useSyncExternalStore(project.problems.subscribe, project.problems.getSnapshot);
const counts = countsOf(files); // { error, warning, info }
```

Without a `problemSource` on the [host](/editor-react/project#languagehost), the reports come from the service's diagnostics. A `problemSource` is a `ProblemSource`: it passes every `ProblemReport` (`path`, `server`, `diagnostics`) to its listener and returns its stop function. Use it to report files no editor holds. A report replaces the earlier one of that server for that file. `serviceProblems(service, pathOf)` is the default source, and `new ProjectProblems(source)` builds a store outside a project.

```ts
const project = new ProjectLanguage(service, {
    folder,
    problemSource: (listener) => backend.onDiagnostics((event) => listener({ path: event.path, server: event.server, diagnostics: event.diagnostics }))
});
```

`project.pullWorkspaceProblems(uri)` asks a server for the problems of every file it knows; see [the project](/editor-react/language-features#the-project).
