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

/* A block statement around the expression, with the caret inside it. */
function block(head: string): string {
    return body(`${head} {`, '\t$0', '}');
}

function script(key: string, text: string, example: string, description: string, expression: PostfixTemplate['expression'] = 'statement'): PostfixTemplate {
    return { id: `builtin.postfix.javascript.${key}`, key, body: text, example, description, languages: ['javascript', 'typescript'], expression };
}

function php(key: string, text: string, example: string, description: string, expression: PostfixTemplate['expression'] = 'statement'): PostfixTemplate {
    return { id: `builtin.postfix.php.${key}`, key, body: text, example, description, languages: ['php'], expression };
}

/* The postfix templates that ship with the editor, after the ones IntelliJ has for JavaScript, TypeScript and PHP. */
export const BUILT_IN_POSTFIX_TEMPLATES: readonly PostfixTemplate[] = [
    script('if', block('if ($EXPR)'), 'if (expr) {}', 'Checks boolean expression to be true'),
    script('else', block('if (!$EXPR)'), 'if (!expr) {}', 'Checks boolean expression to be false'),
    script('null', block('if ($EXPR === null)'), 'if (expr === null) {}', 'Checks expression to be null'),
    script('notnull', block('if ($EXPR !== null)'), 'if (expr !== null) {}', 'Checks expression to be not null'),
    script('return', 'return $EXPR;', 'return expr;', 'Returns the expression from the function'),
    script('throw', 'throw $EXPR;', 'throw expr;', 'Throws the expression'),
    script('const', 'const ${1:name} = $EXPR;', 'const name = expr;', 'Creates a constant from the expression'),
    script('let', 'let ${1:name} = $EXPR;', 'let name = expr;', 'Creates a variable from the expression'),
    script('forof', block('for (const ${1:item} of $EXPR)'), 'for (const item of expr) {}', 'Iterates over the elements (for...of)'),
    script('forin', block('for (const ${1:key} in $EXPR)'), 'for (const key in expr) {}', 'Iterates over the keys (for...in)'),
    script('log', 'console.log($EXPR);', 'console.log(expr);', 'Prints the expression to the console'),
    script('not', '!$EXPR', '!expr', 'Negates the expression', 'any'),
    script('par', '($EXPR)', '(expr)', 'Surrounds the expression with parentheses', 'any'),
    script('arg', '${1:fn}($EXPR)', 'fn(expr)', 'Passes the expression to a function call', 'any'),
    script('await', 'await $EXPR', 'await expr', 'Awaits the expression', 'any'),
    script('typeof', 'typeof $EXPR', 'typeof expr', 'Takes the type of the expression', 'any'),
    php('if', block('if ($EXPR)'), 'if (expr) {}', 'Checks boolean expression to be true'),
    php('isset', block('if (isset($EXPR))'), 'if (isset(expr)) {}', 'Checks that the expression is set'),
    php('empty', block('if (empty($EXPR))'), 'if (empty(expr)) {}', 'Checks that the expression is empty'),
    php('null', block('if ($EXPR === null)'), 'if (expr === null) {}', 'Checks expression to be null'),
    php('notnull', block('if ($EXPR !== null)'), 'if (expr !== null) {}', 'Checks expression to be not null'),
    php('return', 'return $EXPR;', 'return expr;', 'Returns the expression from the function'),
    php('throw', 'throw $EXPR;', 'throw expr;', 'Throws the expression'),
    php('var', '\\$${1:name} = $EXPR;', '$name = expr;', 'Creates a variable from the expression'),
    php('foreach', block('foreach ($EXPR as \\$${1:value})'), 'foreach (expr as $value) {}', 'Iterates over the elements'),
    php('not', '!$EXPR', '!expr', 'Negates the expression', 'any'),
    php('par', '($EXPR)', '(expr)', 'Surrounds the expression with parentheses', 'any')
];
