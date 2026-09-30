import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, postcssIsolateStyles } from 'vitepress';
import llmstxt from 'vitepress-plugin-llms';
import { demoPlugin } from './demo-plugin.ts';
import { librarySourceAliases } from './library-source.ts';
import { sidebar } from './navigation.ts';

// The library reads light and dark from `data-theme` on <html>, VitePress toggles a class there. Inline in
// the head, so the attribute is right before the first paint and follows every toggle after it.
const followAppearance = `(() => {
    const root = document.documentElement;
    const sync = () => { root.dataset.theme = root.classList.contains('dark') ? 'dark' : 'light'; };
    sync();
    new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['class'] });
})();`;

// A demo draws the library with its own reset, so the prose styles of a page stop at `.vp-raw`.
// The base reset stays, since a library button without it would wear the browser's own border.
const isolateDemos = postcssIsolateStyles({ includeFiles: [/vp-doc\.css/] });

export default defineConfig({
    title: 'Desktop',
    titleTemplate: ':title | Desktop',
    description:
        'Packages for desktop apps on Electron, React 19 and Tailwind 4: components and a theme for the page, and the menu, updater and guards of the main process.',
    cleanUrls: true,
    sitemap: {
        hostname: 'https://desktop.bas.dev'
    },
    head: [['script', {}, followAppearance]],
    markdown: {
        config(md) {
            md.use(demoPlugin);
        }
    },
    vite: {
        build: {
            cssTarget: 'chrome120'
        },
        css: {
            postcss: {
                plugins: [isolateDemos]
            }
        },
        plugins: [
            react({ include: /\.tsx$/ }),
            tailwindcss(),
            llmstxt({
                domain: 'https://desktop.bas.dev',
                generateLLMsTxt: true,
                generateLLMsFullTxt: true,
                generateLLMFriendlyDocsForEachPage: true,
                injectLLMHint: true
            })
        ],
        resolve: {
            alias: librarySourceAliases(),
            // The library resolves its dependencies from the repository root and the demos from here; one copy each or hooks and words break.
            dedupe: ['react', 'react-dom', 'i18next', 'react-i18next']
        }
    },
    themeConfig: {
        search: {
            provider: 'local'
        },
        nav: [
            { text: 'Guide', link: '/guide/', activeMatch: '^/guide/' },
            {
                text: 'Packages',
                activeMatch: '^/desktop-(ui|shell)/',
                items: [
                    { text: 'Desktop UI', link: '/desktop-ui/' },
                    { text: 'Desktop Shell', link: '/desktop-shell/' }
                ]
            },
            {
                text: 'Links',
                items: [
                    { text: 'GitHub', link: 'https://github.com/basmilius/desktop' },
                    { text: 'npm', link: 'https://www.npmjs.com/org/basmilius' }
                ]
            }
        ],
        sidebar,
        socialLinks: [{ icon: 'github', link: 'https://github.com/basmilius/desktop' }],
        editLink: {
            pattern: 'https://github.com/basmilius/desktop/edit/main/docs/:path'
        },
        outline: {
            level: [2, 3]
        },
        footer: {
            message: 'Released under the <a href="https://github.com/basmilius/desktop/blob/main/LICENSE">MIT License</a>.',
            copyright: 'Copyright 2026 <a href="https://github.com/basmilius">Bas Milius</a>'
        }
    }
});
