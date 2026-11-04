<template>
    <div class="home-areas">
        <section
            v-for="area of AREAS"
            :key="area.title"
            class="home-area">
            <h2>{{ area.title }}</h2>
            <p>{{ area.summary }}</p>
            <ul>
                <li
                    v-for="item of area.packages"
                    :key="item.link">
                    <a :href="item.link">
                        <span class="name">{{ item.name }}</span>
                        <span class="blurb">{{ item.blurb }}</span>
                    </a>
                </li>
            </ul>
        </section>
    </div>
</template>

<script
    lang="ts"
    setup>
    interface Area {
        readonly title: string;
        readonly summary: string;
        readonly packages: { readonly name: string; readonly link: string; readonly blurb: string }[];
    }

    const AREAS: Area[] = [
        {
            title: 'Interface',
            summary: 'One theme for every window, with the components, charts and terminal drawn in it.',
            packages: [
                {name: 'UI', link: '/ui/', blurb: 'Menus, dialogs, fields, toasts and settings on Base UI'},
                {name: 'Charts', link: '/charts/', blurb: 'Series, heatmaps, timelines and sparklines'},
                {name: 'Terminal', link: '/terminal/', blurb: 'A terminal pane on xterm.js'}
            ]
        },
        {
            title: 'Agents',
            summary: 'Chats with coding agents, from the CLI process in the backend to the thread on screen.',
            packages: [
                {name: 'Agent contracts', link: '/agent-contracts/', blurb: 'The schemas hosts and views share'},
                {name: 'Agents', link: '/agents/', blurb: 'Chat hosts over provider CLIs'},
                {name: 'Agent views', link: '/agents-react/', blurb: 'The thread, the composer, usage and limits'},
                {name: 'Intelligent UI', link: '/intelligent-ui/', blurb: 'Components an agent answers with'}
            ]
        },
        {
            title: 'Editor',
            summary: 'A code editor with its own engine, language features over LSP and review of an agent\'s changes.',
            packages: [
                {name: 'Editor core', link: '/editor-core/', blurb: 'Documents, history and commands'},
                {name: 'Editor', link: '/editor/', blurb: 'The DOM view of a document'},
                {name: 'Editor views', link: '/editor-react/', blurb: 'React editors with language features'},
                {name: 'LSP', link: '/lsp/', blurb: 'A Language Server Protocol client'},
                {name: 'Merge', link: '/merge/', blurb: 'Line diffs and three-way merges'}
            ]
        },
        {
            title: 'Platform',
            summary: 'The Electron main process, a background service, a database client and the helpers they share.',
            packages: [
                {name: 'Shell', link: '/shell/', blurb: 'Menus, updates and windows'},
                {name: 'Service', link: '/service/', blurb: 'A launchd job or systemd service'},
                {name: 'Database', link: '/database/', blurb: 'Browse and query SQLite and MySQL'},
                {name: 'Utils', link: '/utils/', blurb: 'Deadlines, atomic writes and path checks'}
            ]
        },
        {
            title: 'Canvas',
            summary: 'Documents a person and an agent draw and plan in together.',
            packages: [
                {name: 'Drawing', link: '/drawing/', blurb: 'Shapes, geometry and SVG export'},
                {name: 'Diagram', link: '/diagram/', blurb: 'Directed graphs with layered layout'},
                {name: 'Plan', link: '/plan/', blurb: 'Plan trees with operations and permissions'}
            ]
        }
    ];
</script>

<style scoped>
    .home-areas {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 16px;
    }

    .home-area {
        padding: 24px;
        border: 1px solid var(--vp-c-divider);
        border-radius: 12px;
        background: var(--vp-c-bg-soft);
    }

    .home-area h2 {
        margin: 0;
        padding: 0;
        border: 0;
        font-size: 20px;
        line-height: 28px;
    }

    .home-area p {
        margin: 8px 0 16px;
        color: var(--vp-c-text-2);
        font-size: 14px;
        line-height: 22px;
    }

    .home-area ul {
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .home-area li {
        margin: 0;
    }

    .home-area a {
        display: flex;
        flex-direction: column;
        margin: 0 -10px;
        padding: 6px 10px;
        border-radius: 8px;
        text-decoration: none;
        transition: background-color 0.15s;
    }

    .home-area a:hover {
        background: var(--vp-c-default-soft);
    }

    .name {
        color: var(--vp-c-brand-1);
        font-size: 14px;
        font-weight: 600;
        line-height: 20px;
    }

    .blurb {
        color: var(--vp-c-text-2);
        font-size: 13px;
        line-height: 20px;
    }
</style>
