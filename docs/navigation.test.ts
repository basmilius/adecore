import { Glob } from 'bun';
import { describe, expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import type { DefaultTheme } from 'vitepress';
import { nav, sidebar } from './.vitepress/navigation.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));

/* Pages the sidebar leaves out on purpose, each with the reason. */
const UNLISTED: Record<string, string> = {
    '/': 'The home page, reached by the logo.'
};

/* The address of a page: `ui/actions/button.md` is `/ui/actions/button`, and an `index.md` is its folder. */
function addressOf(path: string): string {
    const page = `/${path.replaceAll('\\', '/').replace(/\.md$/, '')}`;

    return page === '/index' ? '/' : page.replace(/\/index$/, '/');
}

const pages = [...new Glob('**/*.md').scanSync({ cwd: HERE })]
    .filter((path) => !/(^|[\\/])(node_modules|\.vitepress|demos)[\\/]/.test(path))
    .map(addressOf)
    .sort();

function linksOf(items: readonly (DefaultTheme.SidebarItem | DefaultTheme.NavItem)[]): string[] {
    return items.flatMap((item) => {
        const link = 'link' in item && typeof item.link === 'string' ? [item.link.replace(/[#?].*$/, '')] : [];
        const children = 'items' in item && item.items !== undefined ? linksOf(item.items as DefaultTheme.SidebarItem[]) : [];

        return [...link, ...children];
    });
}

const sidebarLinks = Object.values(sidebar).flatMap((items) => linksOf(items as DefaultTheme.SidebarItem[]));
const reachable = new Set([...sidebarLinks, ...linksOf(nav)]);

describe('the docs sidebar', () => {
    test('finds the pages', () => {
        expect(pages.length).toBeGreaterThan(300);
        expect(sidebarLinks.length).toBeGreaterThan(300);
    });

    test('lists every page, or says why it leaves one out', () => {
        const missing = pages.filter((page) => !reachable.has(page) && !(page in UNLISTED));

        expect(missing).toEqual([]);
    });

    test('links only to pages that exist', () => {
        const known = new Set(pages);

        expect(sidebarLinks.filter((link) => !known.has(link))).toEqual([]);
    });

    test('lists no page twice in the same sidebar', () => {
        const twice = Object.entries(sidebar).flatMap(([root, items]) => {
            const links = linksOf(items as DefaultTheme.SidebarItem[]);

            return links.filter((link, index) => links.indexOf(link) !== index).map((link) => `${root} ${link}`);
        });

        expect(twice).toEqual([]);
    });

    test('keeps no exemption for a page that is listed or gone', () => {
        const stale = Object.keys(UNLISTED).filter((page) => !pages.includes(page) || reachable.has(page));

        expect(stale).toEqual([]);
    });
});
