import type { LiveTemplate, PostfixTemplate, TemplateLanguage } from './templates.ts';

/* A body of lines; a leading tab is one indentation unit. */
function body(...lines: string[]): string {
    return lines.join('\n');
}

function live(language: string, key: string, languages: readonly TemplateLanguage[], text: string, description: string): LiveTemplate {
    return { id: `builtin.${language}.${key}`, key, body: text, description, languages };
}

function phpFunction(key: string, modifiers: string, description: string): LiveTemplate {
    return live('php', key, ['php'], body(`${modifiers} function \${1:name}($2)`, '{', '\t$0', '}'), description);
}

/* The keys and bodies of the live templates IntelliJ ships for JavaScript, PHP, HTML and XML. */
export const BUILT_IN_LIVE_TEMPLATES: readonly LiveTemplate[] = [
    live('javascript', 'log', ['javascript'], 'console.log($0);', 'Prints a value to the console'),
    live(
        'javascript',
        'itar',
        ['javascript'],
        body('for (let ${1:i} = 0; $1 < ${2:array}.length; $1++) {', '\tconst ${3:element} = $2[$1];', '\t$0', '}'),
        'Iterate elements of array'
    ),
    live(
        'javascript',
        'ritar',
        ['javascript'],
        body('for (let ${1:i} = ${2:array}.length - 1; $1 >= 0; $1--) {', '\tconst ${3:element} = $2[$1];', '\t$0', '}'),
        'Iterate elements of array in reverse order'
    ),
    live('javascript', 'iter', ['javascript'], body('for (const ${1:item} of ${2:iterable}) {', '\t$0', '}'), 'Iterate (for...of)'),
    live('javascript', 'itin', ['javascript'], body('for (const ${1:key} in ${2:object}) {', '\t$0', '}'), 'Iterate (for...in)'),
    live('php', 'fore', ['php'], body('foreach (\\$${1:iterable} as \\$${2:value}) {', '\t$0', '}'), 'foreach(iterable_expr as $value) {...}'),
    live(
        'php',
        'forek',
        ['php'],
        body('foreach (\\$${1:iterable} as \\$${2:key} => \\$${3:value}) {', '\t$0', '}'),
        'foreach(iterable_expr as $key => $value) {...}'
    ),
    phpFunction('pubf', 'public', 'public function'),
    phpFunction('prif', 'private', 'private function'),
    phpFunction('prof', 'protected', 'protected function'),
    phpFunction('pubsf', 'public static', 'public static function'),
    live('php', 'thr', ['php'], 'throw new $0;', 'throw new'),
    live('html', 'T', ['html', 'xml'], '<${1:tag}>$TM_SELECTED_TEXT</${1/\\s.*//}>', 'Surround with <tag></tag>'),
    live('xml', 'CD', ['xml'], body('<![CDATA[', '$TM_SELECTED_TEXT', ']]>'), 'Surround with CDATA section')
];

/* The postfix templates that ship with the editor. */
export const BUILT_IN_POSTFIX_TEMPLATES: readonly PostfixTemplate[] = [];
