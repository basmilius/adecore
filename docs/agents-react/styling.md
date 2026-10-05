# CSS, theme, and translations

The host owns its Tailwind build, theme mode, formatters, translations, and diff worker bundling. The package ships `theme.css` and English/Dutch locale JSON with both source and compiled targets. Importing a component does not import its stylesheet.

## Scan linked source and compiled files

Use Tailwind 4 and add `@tailwindcss/typography` to the consumer's dependencies. Import the UI theme before the chat theme. These paths assume the stylesheet is at the consumer root; adjust `@source` paths relative to the CSS file:

```css
@import 'tailwindcss';
@import '@adecore/ui/theme.css';
@import '@adecore/agents-react/theme.css';
@source "./node_modules/@adecore/ui/dist";
@source "./node_modules/@adecore/agents-react/dist";
@plugin "@tailwindcss/typography";
```

When linked source is selected, replace those `dist` scan roots with the linked packages' `src` paths, or scan both if the consumer intentionally supports either export mode. Package source is shipped, but dependency classes are not reliably found through Tailwind's ordinary application scan. A valid JavaScript import alone does not generate its utility CSS.

## Theme tokens

The chat theme uses UI surface, text, font, accent, and type-scale tokens. It adds skill colors, provider chart colors, context chart colors, and component rules. Match the UI's `data-theme="light"`/`"dark"` attribute with `ChatHost.code.useMode()`.

Tool output and diffs also need terminal colors. A host using `@adecore/terminal` can import `@adecore/terminal/terminal.css` after the UI theme to provide `--term-bg`, `--term-fg`, and the 16 `--term-ansi-*` values. Otherwise supply those variables in the host theme. This is a consumer stylesheet choice, not an agents-react dependency.

Map the host's terminal/find colors into Tailwind's named utilities too. For example, with that terminal palette loaded:

```css
:root {
    --term-green: var(--term-ansi-green);
    --term-red: var(--term-ansi-red);
    --find-current: var(--accent);
}

@theme inline {
    --color-term-bg: var(--term-bg);
    --color-term-fg: var(--term-fg);
    --color-term-green: var(--term-green);
    --color-term-red: var(--term-red);
    --color-find-current: var(--find-current);
}
```

ANSI output reads `--term-ansi-black` through `--term-ansi-white` and their `--term-ansi-bright-*` variants directly. The names above also generate classes such as `text-term-red` and `bg-find-current`. A palette without utility mappings leaves those classes missing.

The thread spacing defaults are 16/24/12 px for answer/turn/block gaps, and 20/32/16 px under `.chat-column`. Override the component-layer rules in the host stylesheet:

```css
.chat-thread,
.chat-column .chat-thread {
    --chat-answer-gap: 14px;
    --chat-turn-gap: 14px;
    --chat-block-gap: 8px;
}
```

`.chat-column` also provides a centered reading column. Keep the outer frame's height and flex sizing valid so the timeline can virtualize and scroll. Theme overrides should retain readable focus, selection, and disabled states in both modes; desktop keyboard and screen-reader checks remain part of host integration.

## Code themes and streamed text

`ChatHost.code` supplies stable `useMode` and `useThemes` hooks plus `custom` Shiki theme registrations. The default theme IDs are `github-light` and `github-dark`. Custom registrations need a `name` matching the chosen ID. Code highlighting loads lazily from Shiki's web bundle; unknown languages fall back to plain text.

`useStreaming` chooses words, blocks, or whole replies. The CSS includes reveal/fade rules, but the host should test its reduced-motion setting with the rest of its theme. A host's file-editor theme is not automatically a chat code theme.

## Diff workers and lazy modules

Vite can construct the diff worker through a query import. This requires the consumer to resolve `@pierre/diffs` and include Vite's `vite/client` types. Other bundlers must supply an equivalent worker factory.

```tsx
import { Suspense, type ReactNode } from 'react';
import { ErrorBoundary } from '@adecore/ui';
import DiffPool from '@adecore/agents-react/chat/ui/DiffPool';
import DiffWorker from '@pierre/diffs/worker/worker.js?worker';

export function ChatDiffWorkers({ children }: { children: ReactNode }) {
    return (
        <DiffPool workerFactory={() => new DiffWorker()}>
            <ErrorBoundary label="File changes">
                <Suspense fallback={<p>Loading file changes...</p>}>{children}</Suspense>
            </ErrorBoundary>
        </DiffPool>
    );
}
```

Place one pool around the related chat views. It shares two highlighter workers using a singleton supplied by the diff library. The host owns asset URLs, worker CSP, and bundler behavior; the React package does not set a desktop security policy.

`setLazyPrefetch` registers the package's named lazy loaders with a host prefetcher. `onLazyOpenError` reports only render-load failures and returns an unsubscribe function. Prefetch failures do not trigger that callback. See [host adapters](./host#async-ownership).

## Translations and formatters

`AGENTS_NAMESPACES` contains `agent-chat`, `agent-prompts`, `agent-providers`, and `agent-usage`. `AGENTS_LOCALES.en()` and `.nl()` load all namespaces for that language. JSON is also exposed under `@adecore/agents-react/locales/*.json`, for example `locales/en/agent-chat.json`.

Use the default i18next instance for both package helpers and React. Add bundles before rendering or changing to that language. A host offering regional language codes can map them to an available language loader and register the bundles under its chosen code. A missing loader is not an automatic fallback function.

```tsx
import i18next from 'i18next';
import type { ReactNode } from 'react';
import { UIProvider } from '@adecore/ui';
import { FORMAT_LANGUAGE, type FormatSource } from '@adecore/ui/format';
import { AGENTS_LOCALES } from '@adecore/agents-react/locales';

const formatSource: FormatSource = {
    language: () => i18next.language,
    region: () => FORMAT_LANGUAGE,
    subscribe: (changed) => {
        i18next.on('languageChanged', changed);
        return () => {
            i18next.off('languageChanged', changed);
        };
    }
};

export async function addChatLanguage(language: 'en' | 'nl'): Promise<void> {
    for (const [namespace, words] of Object.entries(await AGENTS_LOCALES[language]!())) {
        i18next.addResourceBundle(language, namespace, words, true, true);
    }
}

export function ChatProviders({ children }: { children: ReactNode }) {
    return (
        <UIProvider i18n={i18next} formatSource={formatSource}>
            {children}
        </UIProvider>
    );
}
```

Initialize i18next/react-i18next as in [setup](./getting-started#configure-words-and-storage) first. `UIProvider` adds UI words and installs formatter sources; it does not load the agent namespaces. `FORMAT_LANGUAGE` uses the language's region. See [UIProvider](/ui/utilities/ui-provider) and [formatting](/ui/formatting/) for host-specific region choices.
