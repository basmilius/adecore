# React Compiler

The packages with React views (UI, Charts, Terminal, Agent views and Editor views) ship a `dist` built with the [React Compiler](https://react.dev/learn/react-compiler), so their components and hooks memoize themselves. The compiled code imports `react/compiler-runtime`, which comes with React 19.

## Reading the sources

The `source` condition serves uncompiled TypeScript, which has no hand-written `useMemo` or `useCallback`. Without the compiler the views still work, but redraw whenever their parent does.

To keep the memoization, run `babel-plugin-react-compiler` with `target: '19'` over these sources, in Vite through `reactCompilerPreset` of `@vitejs/plugin-react`. If your bundler setup skips `node_modules`, include the `src` of these packages. A production build without the `source` condition uses the compiled `dist`.

## What stays uncompiled

A function that starts with `'use no memo'` stays uncompiled, in `dist` too. So does one the compiler cannot prove safe.
