# Design checks

`@adecore/ui/design-conventions` checks the source of an app against the design rules of the library: type sizes, tooltips, icon sizes, tokens instead of raw colors and the like. Run it from a lint script. It needs `oxc-parser`, an optional peer dependency of `@adecore/ui`.

```ts
import { designProblemsIn } from '@adecore/ui/design-conventions';
```

## designProblemsIn

`designProblemsIn(sources, options?)` takes the files of one folder as `DesignSource`s (`{ path, text }`, the tests left out) and returns a `DesignProblem` (`{ rule, location }`) for each rule they break. `location` starts with the path of the source and says the line when it has one. A script prints them and fails when the list is not empty.

```ts
import { designProblemsIn } from '@adecore/ui/design-conventions';

const problems = designProblemsIn(sources, {
    rules: ['keyListeners', 'tooltip', 'intl', 'color'],
    keyListeners: ['src/shell/app-shortcuts.ts'],
    formatterDirectory: 'src/format/'
});

for (const { rule, location } of problems) {
    console.error(`${location}: ${rule}`);
}
```

## Options

`DesignOptions` fits a folder to the rules. Paths are compared as written in the sources.

| Option | Meaning |
| --- | --- |
| `rules` | The `DesignRule`s to run. Every rule in `DESIGN_RULES` runs when it is absent. |
| `pageExclusions` | Path prefixes of code that draws nothing, such as a protocol or a host. |
| `keyListeners` | The files that may listen for a key on the window or the document. |
| `formatterDirectory` | A path prefix where `Intl` may build a formatter. |
| `intlExempt` | Files outside it that may use `Intl` as well. |
| `buttonFile` | The file that defines the button, which may style a `<button>` itself. |
| `namespace` | The i18next namespace every `useTranslation` call must name. |
| `namespaceExempt` | Files that may name another namespace, or none. |
| `colorExempt` | Files that write a color as paint, such as a syntax palette. |
| `theme` | The text of the theme stylesheet, checked for its type scale, raw colors and lengths. |

## DESIGN_RULES

`DESIGN_RULES` lists the rules by name: `keyListeners`, `typeSize`, `uppercase`, `focusRing`, `tooltip`, `wordButton`, `iconButtonSize`, `iconButtonIcon`, `iconScale`, `intl`, `color`, `fractionalPixel`, `namespace` and `forwardRef`. A `DesignRule` is one of them. An app that states fewer rules than the library lists the ones it keeps in `rules`.
