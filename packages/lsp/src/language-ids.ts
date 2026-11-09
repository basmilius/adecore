/* The LSP ids of the script languages. */
export const SCRIPT_LANGUAGE_IDS = ['typescript', 'typescriptreact', 'javascript', 'javascriptreact'] as const;

/* Every name a highlighter, a file extension or a client uses for a language, mapped to the LSP id of that language. */
const LSP_IDS: Readonly<Record<string, string>> = {
    typescript: 'typescript',
    ts: 'typescript',
    mts: 'typescript',
    cts: 'typescript',
    tsx: 'typescriptreact',
    javascript: 'javascript',
    js: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    jsx: 'javascriptreact',
    vue: 'vue',
    php: 'php',
    css: 'css',
    scss: 'scss',
    less: 'less',
    html: 'html',
    json: 'json',
    jsonc: 'jsonc',
    yaml: 'yaml',
    yml: 'yaml',
    python: 'python',
    py: 'python',
    shellscript: 'shellscript',
    sh: 'shellscript',
    bash: 'shellscript',
    zsh: 'shellscript',
    docker: 'dockerfile',
    twig: 'twig',
    sql: 'sql',
    rust: 'rust',
    markdown: 'markdown',
    toml: 'toml',
    lua: 'lua',
    go: 'go',
    swift: 'swift',
    zig: 'zig'
};

/* The LSP id of a language, or null when no language server here knows it. */
export function lspLanguageIdOf(language: string | undefined): string | null {
    return language === undefined ? null : (LSP_IDS[language] ?? null);
}

/* The LSP id for a name a client may use, which is the name itself for a language the table does not list. */
export function lspLanguageId(language: string): string {
    return LSP_IDS[language] ?? language;
}

/* Files that are JSON with comments and trailing commas: a JSON server reports both as errors in a plain `json` document. */
const JSONC_FILES =
    /(^|\/)(tsconfig(\..+)?\.json|jsconfig(\..+)?\.json|\.eslintrc(\.json)?|\.babelrc(\.json)?|\.swcrc|devcontainer\.json|\.devcontainer\/.+\.json|\.vscode\/.+\.json|.+\.jsonc)$/;

/* The language id a document opens with: the LSP id of the language, except for a JSON file that allows comments. */
export function documentLanguageId(language: string, path: string): string {
    const id = lspLanguageId(language);

    return id === 'json' && JSONC_FILES.test(path) ? 'jsonc' : id;
}
