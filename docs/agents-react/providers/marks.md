# Agent marks

The marks of the agent CLIs and the dot of an account's color.

<Demo src="agents/marks" />

| Component                                   | Import                   |                                                                                               |
| ------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------- |
| `AgentIcon({ kind, size?, className? })`    | `@adecore/agents-react/providers` | The mark of an `AgentKind` in the current text color, with a label for screen readers. A kind without a mark gets a robot. |
| `CliMark({ kind, size?, className? })`      | `@adecore/agents-react/providers` | The same mark in the CLI's chart color, so it matches the usage page.                         |
| `CliTile({ kind })`                         | `@adecore/agents-react/providers` | A 24 pixel mark as tall as a title's first line, for a list row.                              |
| `ProviderLogo({ provider, size?, className? })` | `@adecore/agents-react/providers` | The mark of a `UsageProvider`, decorative.                                                    |
| `AccountDot({ color, className? })`         | `@adecore/agents-react/providers` | An account's color: one of the host's `accents` by id, or the app's accent for any other.     |

`size` is in pixels, 14 by default.

## A mark for a kind the host adds

A kind of your own, such as one run through [`createAcpProvider`](/agents/acp), gets its mark once with `configureAgentMarks` from `@adecore/agents-react`, before the first render. Every view that draws an agent's mark uses it.

```ts
import { configureAgentMarks } from '@adecore/agents-react';

configureAgentMarks({
    acme: { title: 'Acme', path: 'M12 2 2 22h20Z' },
    orbit: { title: 'Orbit', path: 'M8 1a7 7 0 1 0 0 14A7 7 0 1 0 8 1Z', viewBox: '0 0 16 16' }
});
```

An `AgentMark` is one SVG `path` in `currentColor`, with a `title` for screen readers and an optional `viewBox` (`0 0 24 24` by default). A mark for a built-in kind replaces it. A later call replaces the whole set.
