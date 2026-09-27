import { describe, expect, test } from 'bun:test';
import { Glob } from 'bun';
import type { ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DemoFrame } from './.vitepress/theme/DemoFrame.tsx';

const HERE = new URL('.', import.meta.url).pathname;

const demos = [...new Glob('demos/**/*.tsx').scanSync(HERE)].filter((path) => !path.startsWith('demos/shared/')).sort();

describe('the demos', () => {
    // A static render runs no effect and opens no popup, but a demo that throws while it draws fails here before it fails on the site.
    test.each(demos)('%s renders', async (path) => {
        const { default: Demo } = (await import(`./${path}`)) as { default: ComponentType };
        const render = (): string =>
            renderToStaticMarkup(
                <DemoFrame src={path}>
                    <Demo />
                </DemoFrame>
            );
        expect(render).not.toThrow();
    });
});
