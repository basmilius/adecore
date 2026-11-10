# Reference

Every name each entry point exports, read from its source. Anything not listed is internal and may change in any release.

Two entry points hold no code. `@adecore/editor-react/editor-react.css` holds the styles of the cards; see [Getting started](/editor-react/getting-started#styles). `@adecore/editor-react/locales/en` and `nl` hold the words of the `editor` namespace, which an app adds to its i18next instance; see [Words](/editor-react/getting-started#words).

## `@adecore/editor-react`

The components, `ProjectLanguage`, `EditorLanguage`, the features, the hosts and the popup views.

<ExportTable entry="@adecore/editor-react" />

## `@adecore/editor-react/models`

The pure functions behind the features and their types, without React. See [Models](/editor-react/models).

<ExportTable entry="@adecore/editor-react/models" />

## `@adecore/editor-react/snippet-transform-worker`

The worker that runs snippet transforms, and its client. It imports no React. See [isolated transforms](/editor-react/snippets#isolated-transforms).

<ExportTable entry="@adecore/editor-react/snippet-transform-worker" />

## `@adecore/editor-react/testing`

A fake language service and a manual clock. See [Testing](/editor-react/testing).

<ExportTable entry="@adecore/editor-react/testing" />
