import { globSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { MarkdownRenderer } from 'vitepress';
import { absolute, moduleOf, publishedEntries } from '../published-exports.ts';

export type ExportKind = 'class' | 'component' | 'const' | 'enum' | 'function' | 'hook' | 'namespace' | 'type';

export interface ExportRow {
    readonly name: string;
    readonly kind: ExportKind;
    /* From the repository's root. */
    readonly file: string;
}

const REPOSITORY = 'https://github.com/basmilius/adecore/blob/main';
const DOCS = absolute('docs');

const EXPORT_TABLE_TAG = /^<ExportTable\s+entry="([^"]+)"\s*\/>$/;

const DECLARATION =
    '(?:export\\s+)?(?:declare\\s+)?(?:default\\s+)?(?:abstract\\s+)?(?:async\\s+)?(function\\*?|class|const|let|var|interface|type|enum|namespace)\\s+';

function withoutComments(text: string): string {
    return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/* `rest` is the text after the declared name, which tells a constant from an arrow function. */
function kindOfDeclaration(keyword: string, name: string, file: string, rest: string): ExportKind {
    if (keyword === 'interface' || keyword === 'type') {
        return 'type';
    }

    if (keyword === 'class' || keyword === 'enum' || keyword === 'namespace') {
        return keyword;
    }

    if (/^use[A-Z]/.test(name)) {
        return 'hook';
    }

    if (file.endsWith('.tsx') && /^[A-Z]/.test(name) && !/^[A-Z0-9_]+$/.test(name)) {
        return 'component';
    }

    if (keyword.startsWith('function') || /^\s*(?::[^=]*)?=\s*(?:async\s+)?(?:\(|function\b|[\w$]+\s*=>)/.test(rest)) {
        return 'function';
    }

    return 'const';
}

/* What `name` is in `file`, following imports and re-exports to where it is declared. */
function kindOf(file: string, name: string, typeOnly: boolean, seen = new Set<string>()): ExportKind {
    const fallback = typeOnly ? 'type' : 'const';
    const key = `${file}#${name}`;

    if (seen.has(key)) {
        return fallback;
    }

    seen.add(key);

    const text = withoutComments(readFileSync(file, 'utf8'));
    const declaration = new RegExp(`^\\s*${DECLARATION}(${name.replace('$', '\\$')})\\b`, 'm').exec(text);

    if (declaration !== null) {
        return kindOfDeclaration(
            declaration[1]!,
            name,
            file,
            text.slice(declaration.index + declaration[0].length, declaration.index + declaration[0].length + 200)
        );
    }

    for (const match of text.matchAll(/^(?:export|import)\s+(type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/gm)) {
        for (const part of match[2]!.split(',')) {
            const [original, alias] = part
                .trim()
                .replace(/^type\s+/, '')
                .split(/\s+as\s+/) as [string, string | undefined];

            if ((alias ?? original) !== name) {
                continue;
            }

            const target = moduleOf(file, match[3]!);

            return target === null ? fallback : kindOf(target, original, typeOnly || match[1] !== undefined || part.trim().startsWith('type '), seen);
        }
    }

    return fallback;
}

/* Every name an entry point exports, with the module it comes from, in the order the entry lists them. */
export function exportRows(file: string, seen = new Set<string>()): ExportRow[] {
    if (seen.has(file)) {
        return [];
    }

    seen.add(file);

    const text = withoutComments(readFileSync(file, 'utf8'));
    const rows: ExportRow[] = [];

    const add = (name: string, kind: ExportKind, from: string): void => {
        rows.push({ name, kind, file: relative(absolute('.'), from).replaceAll('\\', '/') });
    };

    for (const match of text.matchAll(/^export\s+(type\s+)?\{([^}]*)\}(?:\s*from\s*['"]([^'"]+)['"])?/gm)) {
        const target = match[3] === undefined ? file : (moduleOf(file, match[3]) ?? file);

        for (const part of match[2]!.split(',')) {
            const trimmed = part.trim();

            if (trimmed === '') {
                continue;
            }

            const typeOnly = match[1] !== undefined || trimmed.startsWith('type ');
            const [original, alias] = trimmed.replace(/^type\s+/, '').split(/\s+as\s+/) as [string, string | undefined];
            const name = alias ?? original;

            if (name !== 'default') {
                add(name, kindOf(target, original, typeOnly), target);
            }
        }
    }

    for (const match of text.matchAll(new RegExp(`^export\\s+${DECLARATION.slice('(?:export\\s+)?'.length)}([\\w$]+)`, 'gm'))) {
        const end = match.index + match[0].length;

        add(match[2]!, kindOfDeclaration(match[1]!, match[2]!, file, text.slice(end, end + 200)), file);
    }

    for (const match of text.matchAll(/^export\s+\*\s+as\s+([\w$]+)\s+from\s+['"]([^'"]+)['"]/gm)) {
        add(match[1]!, 'namespace', moduleOf(file, match[2]!) ?? file);
    }

    for (const match of text.matchAll(/^export\s+\*\s+from\s+['"]([^'"]+)['"]/gm)) {
        const target = moduleOf(file, match[1]!);

        if (target !== null) {
            rows.push(...exportRows(target, seen));
        }
    }

    const names = new Set<string>();

    return rows.filter((row) => !names.has(row.name) && names.add(row.name));
}

interface Page {
    readonly link: string;
    readonly text: string;
}

/* The pages of a package's folder that explain it, so not the reference page being drawn. */
function pagesOf(folder: string, drawing: string): Page[] {
    return globSync(`${folder}/**/*.md`, { cwd: DOCS })
        .map((path) => path.replaceAll('\\', '/'))
        .filter((path) => path !== drawing)
        .sort()
        .map((path) => ({
            link: `/${path.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '')}`,
            text: readFileSync(join(DOCS, path), 'utf8')
        }));
}

/* The page that explains `name` best: one with it in a heading, then in code, then anywhere. */
function pageFor(name: string, pages: Page[]): Page | null {
    const escaped = name.replace('$', '\\$');
    const word = new RegExp(`(?<![\\w$])${escaped}(?![\\w$])`);
    const heading = new RegExp(`^#+ .*(?<![\\w$])${escaped}(?![\\w$])`, 'm');
    const code = new RegExp(`\`[^\`\\n]*(?<![\\w$])${escaped}(?![\\w$])[^\`\\n]*\``);

    return pages.find((page) => heading.test(page.text)) ?? pages.find((page) => code.test(page.text)) ?? pages.find((page) => word.test(page.text)) ?? null;
}

function renderTable(entry: string, drawing: string, escape: (text: string) => string): string {
    const published = publishedEntries().find((candidate) => `${candidate.pkg}${candidate.entry.slice(1)}` === entry);

    if (published === undefined) {
        throw new Error(`<ExportTable entry="${entry}" /> names no published entry point.`);
    }

    const pages = pagesOf(published.pkg.replace(/^@adecore\//, ''), drawing);

    const rows = exportRows(absolute(published.file)).map((row) => {
        const page = pageFor(row.name, pages);
        const name = `<code>${escape(row.name)}</code>`;
        const module = row.file.replace(/^packages\/[^/]+\/src\//, '').replace(/\.tsx?$/, '');

        return [
            '<tr>',
            `<td>${page === null ? name : `<a href="${page.link}">${name}</a>`}</td>`,
            `<td><span class="export-kind" data-kind="${row.kind}">${row.kind}</span></td>`,
            `<td><a href="${REPOSITORY}/${row.file}" target="_blank" rel="noreferrer"><code>${escape(module)}</code></a></td>`,
            '</tr>'
        ].join('');
    });

    return `<table class="export-table"><thead><tr><th>Name</th><th>Kind</th><th>Source</th></tr></thead><tbody>${rows.join('')}</tbody></table>\n`;
}

/*
 * Turns an export table tag into the table of what that entry point exports, read from the sources at
 * build time, so a reference never lists a name that is gone. Each name links the page that explains it.
 */
export function exportTablePlugin(md: MarkdownRenderer): void {
    for (const rule of ['html_block', 'html_inline'] as const) {
        const html = md.renderer.rules[rule]!;

        md.renderer.rules[rule] = (tokens, index, options, env: { relativePath?: string }, self) => {
            const match = EXPORT_TABLE_TAG.exec(tokens[index]!.content.trim());

            if (match === null) {
                return html(tokens, index, options, env, self);
            }

            return renderTable(match[1]!, env.relativePath ?? '', md.utils.escapeHtml);
        };
    }
}
