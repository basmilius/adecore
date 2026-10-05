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
    title: 'ADE CORE',
    titleTemplate: ':title | ADE CORE',
    description:
        'Packages for desktop apps on Electron, React 19 and Tailwind 4: UI and terminal views, agent hosts and chat, database tooling, drawing and diagram cores, merge algorithms, language-enabled editors, a PHP language server and user services.',
    cleanUrls: true,
    sitemap: {
        hostname: 'https://adecore.dev'
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
                domain: 'https://adecore.dev',
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
        siteTitle: false,
        search: {
            provider: 'local'
        },
        nav: [
            { text: 'Guide', link: '/guide/', activeMatch: '^/guide/' },
            {
                text: 'Packages',
                activeMatch:
                    '^/(ui|shell|terminal|database|agent-contracts|agents|agents-react|merge|drawing|diagram|plan|service|editor-core|editor|lsp|editor-react|php-language-server)/',
                items: [
                    { text: 'UI', link: '/ui/' },
                    { text: 'Shell', link: '/shell/' },
                    { text: 'Terminal', link: '/terminal/' },
                    { text: 'Database', link: '/database/' },
                    { text: 'Agent contracts', link: '/agent-contracts/' },
                    { text: 'Agents', link: '/agents/' },
                    { text: 'Agent views', link: '/agents-react/' },
                    { text: 'Merge', link: '/merge/' },
                    { text: 'Drawing', link: '/drawing/' },
                    { text: 'Diagram', link: '/diagram/' },
                    { text: 'Plan', link: '/plan/' },
                    { text: 'Service', link: '/service/' },
                    { text: 'Editor core', link: '/editor-core/' },
                    { text: 'Editor', link: '/editor/' },
                    { text: 'LSP', link: '/lsp/' },
                    { text: 'Editor views', link: '/editor-react/' },
                    { text: 'PHP language server', link: '/php-language-server/' }
                ]
            },
            {
                text: 'Links',
                items: [
                    { text: 'GitHub', link: 'https://github.com/basmilius/adecore' },
                    { text: 'npm', link: 'https://www.npmjs.com/org/adecore' }
                ]
            }
        ],
        sidebar,
        socialLinks: [{ icon: 'github', link: 'https://github.com/basmilius/adecore' }],
        editLink: {
            pattern: 'https://github.com/basmilius/adecore/edit/main/docs/:path'
        },
        outline: {
            level: [2, 3]
        },
        footer: {
            message: 'Licenses and third-party notices are listed in each package.',
            copyright: 'Copyright 2026 <a href="https://github.com/basmilius">Bas Milius</a>'
        }
    }
});
