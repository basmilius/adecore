import { GlobalRegistrator } from '@happy-dom/global-registrator';

/*
 * `bun test --preload` for the interaction tests. The DOM has to stand before any package loads: Base UI
 * and React DOM read `document` once, as they load, and a copy loaded without it never opens a menu.
 * Bun runs every test file in one process, so the files that need this run in a process of their own
 * (`dom.test.ts` starts it), and the rest of the suite never sees a DOM.
 */
GlobalRegistrator.register({ url: 'http://localhost/', width: 1200, height: 800 });

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
