import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, postcssIsolateStyles } from 'vitepress';
import llmstxt from 'vitepress-plugin-llms';
import { demoPlugin } from './demo-plugin.ts';
import { librarySourceAliases } from './library-source.ts';
import { navigation } from './navigation.ts';

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
    title: 'Desktop UI',
    titleTemplate: ':title | Desktop UI',
    description: 'React components, a theme, formatters and a settings dialog for desktop-grade apps on React 19, Base UI and Tailwind 4.',
    cleanUrls: true,
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
                domain: 'https://react-ui.bas.dev',
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
            { text: 'Guide', link: '/guide/getting-started', activeMatch: '^/guide/' },
            { text: 'Components', link: '/actions/button', activeMatch: '^/(actions|inputs|overlays|display|layout)/' },
            { text: 'Settings', link: '/settings/settings-dialog', activeMatch: '^/settings/' },
            { text: 'Formatting', link: '/formatting/', activeMatch: '^/formatting/' },
            { text: 'Hooks', link: '/hooks/use-async-action', activeMatch: '^/(hooks|utilities)/' }
        ],
        sidebar: navigation,
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
