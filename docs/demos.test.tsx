import { Glob } from 'bun';
import { describe, expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import type { ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DemoFrame } from './.vitepress/theme/DemoFrame.tsx';

const HERE = fileURLToPath(new URL('.', import.meta.url));

const demos = [...new Glob('demos/**/*.tsx').scanSync(HERE)]
    .map((path) => path.replaceAll('\\', '/'))
    .filter((path) => !path.startsWith('demos/shared/'))
    .sort();

// Loaded with the file, so the time a slow machine takes to load a package is not a demo's to spend.
const modules = new Map(await Promise.all(demos.map(async (path) => [path, ((await import(`./${path}`)) as { default: ComponentType }).default] as const)));

describe('the demos', () => {
    // A static render runs no effect and opens no popup, but a demo that throws while it draws fails here before it fails on the site.
    test.each(demos)('%s renders', (path) => {
        const Demo = modules.get(path)!;
        const render = (): string =>
            renderToStaticMarkup(
                <DemoFrame src={path}>
                    <Demo />
                </DemoFrame>
            );
        expect(render).not.toThrow();
    });
});
