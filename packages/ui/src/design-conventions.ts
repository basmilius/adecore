import { parseSync, Visitor, type JSXElement, type JSXElementName, type JSXFragment, type Program } from 'oxc-parser';
import { ICON_BUTTON_CLASS, ICON_BUTTON_ICON_SIZE, type IconButtonSize } from './icon-button-size.ts';

export interface DesignSource {
    path: string;
    text: string;
}

export const DESIGN_RULES = [
    'keyListeners',
    'typeSize',
    'uppercase',
    'focusRing',
    'outlineAccent',
    'tooltip',
    'wordButton',
    'iconButtonSize',
    'iconButtonIcon',
    'iconScale',
    'intl',
    'color',
    'fractionalPixel',
    'namespace',
    'forwardRef'
] as const;

export type DesignRule = (typeof DESIGN_RULES)[number];

/* Paths are the ones of the `DesignSource`s, compared as written. */
export interface DesignOptions {
    /* Only these rules run; every rule runs when absent. */
    rules?: readonly DesignRule[];
    pageExclusions?: readonly string[];
    /* The files that may listen for a key on the window or the document. */
    keyListeners?: readonly string[];
    /* A path under it may build a formatter out of `Intl`. */
    formatterDirectory?: string;
    /* The files outside it that may use `Intl` too. */
    intlExempt?: readonly string[];
    buttonFile?: string;
    namespace?: string;
    namespaceExempt?: readonly string[];
    colorExempt?: readonly string[];
    theme?: string;
}

export interface DesignProblem {
    rule: string;
    location: string;
}

/* A hex color, or a color function given numbers, in a string; one given a token (`rgb(var(--x))`) is not raw. */
const RAW_COLOR = /(?:^|[\s[(:,'"])#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})(?![0-9a-z])|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(\s*[\d.]/i;

/* The problems of the sources of one folder against the design rules of the library; the `theme` option adds those of its stylesheet. */
export function designProblemsIn(files: readonly DesignSource[], options: DesignOptions = {}): DesignProblem[] {
    const sources = () => files;
    const pageSources = () => files.filter(({ path }) => !options.pageExclusions?.some((folder) => path.startsWith(folder)));
    /* Where `title` is not a hint but the element's accessible name, which a Tooltip does not give. */
    const TITLE_AS_NAME = new Set(['iframe']);

    /* A segment of a control or a row that toggles says what it is with one of these, and a row of a list
       with its left-aligned text; neither is a Button. */
    const ROW_ATTRIBUTES = new Set(['role', 'aria-pressed', 'aria-checked']);

    /* An icon button takes its size, and with it its radius, from its modifier. `w-auto` is the one way it widens, for a label beside its icon. */
    const ICON_BUTTON_SIZE = /^(?:h|w|size|min-h|min-w|max-h|max-w)-(?!auto$)|^rounded/;

    /* The icon each size of icon button draws, by the modifier on it; no modifier is the default of 32. */
    const ICON_IN_BUTTON: Record<string, number> = Object.fromEntries(
        (Object.entries(ICON_BUTTON_CLASS) as [IconButtonSize, string | undefined][]).flatMap(([size, modifier]) =>
            modifier === undefined ? [] : [[modifier, ICON_BUTTON_ICON_SIZE[size]]]
        )
    );

    /* Sizes between the steps of 12, 14, 16 and 20, which is what an icon anywhere keeps to. */
    const OFF_SCALE_ICON = new Set([13, 15, 17, 18]);

    const programs = new Map<string, Program>();

    const programOf = (path: string, text: string): Program => {
        let program = programs.get(path);
        if (program === undefined) {
            program = parseSync(path, text).program;
            programs.set(path, program);
        }
        return program;
    };

    const lineOf = (text: string, offset: number): number => text.slice(0, offset).split('\n').length;

    const nameOf = (name: JSXElementName): string => {
        switch (name.type) {
            case 'JSXIdentifier':
                return name.name;
            case 'JSXNamespacedName':
                return `${name.namespace.name}:${name.name.name}`;
            case 'JSXMemberExpression':
                return `${nameOf(name.object)}.${name.property.name}`;
        }
    };

    type Tree = JSXElement | JSXFragment;

    /* The outermost elements inside an expression, such as the one in `{open && <Dialog />}`. */
    const elementsIn = (node: unknown): Tree[] => {
        if (Array.isArray(node)) {
            return node.flatMap(elementsIn);
        }
        if (node === null || typeof node !== 'object' || !('type' in node)) {
            return [];
        }
        if (node.type === 'JSXElement' || node.type === 'JSXFragment') {
            return [node as Tree];
        }
        return Object.entries(node).flatMap(([key, value]) => (key === 'parent' ? [] : elementsIn(value)));
    };

    const nodesIn = (node: unknown): { type: string }[] => {
        if (Array.isArray(node)) {
            return node.flatMap(nodesIn);
        }
        if (node === null || typeof node !== 'object') {
            return [];
        }
        const children = Object.entries(node).flatMap(([key, value]) => (key === 'parent' ? [] : nodesIn(value)));
        return 'type' in node && typeof node.type === 'string' ? [node as { type: string }, ...children] : children;
    };

    const classesIn = (value: unknown): string =>
        nodesIn(value)
            .flatMap((node) => {
                if (node.type === 'Literal' && 'value' in node && typeof node.value === 'string') {
                    return [node.value];
                }
                if (node.type === 'TemplateElement' && 'value' in node) {
                    return [(node.value as { cooked: string }).cooked];
                }
                return [];
            })
            .join(' ');

    const stringsOf = (path: string, text: string): { classes: string; start: number }[] =>
        nodesIn(programOf(path, text)).flatMap((node) =>
            node.type === 'Literal' || node.type === 'TemplateElement'
                ? [{ classes: classesIn([node]), start: (node as unknown as { start: number }).start }]
                : []
        );

    const attributeOf = (node: JSXElement, name: string): unknown =>
        node.openingElement.attributes.find(
            (attribute) => attribute.type === 'JSXAttribute' && attribute.name.type === 'JSXIdentifier' && attribute.name.name === name
        );

    const literalOf = (node: JSXElement, name: string): unknown => {
        const attribute = attributeOf(node, name) as
            | { value: { type: string; value?: unknown; expression?: { type: string; value?: unknown } } | null }
            | undefined;
        if (attribute === undefined || attribute.value === null) {
            return undefined;
        }
        if (attribute.value.type === 'Literal') {
            return attribute.value.value;
        }
        return attribute.value.type === 'JSXExpressionContainer' && attribute.value.expression?.type === 'Literal' ? attribute.value.expression.value : null;
    };

    const classesOf = (node: JSXElement): string => classesIn((attributeOf(node, 'className') as { value: unknown } | undefined)?.value);

    /* The size an icon is drawn at, when the source says it as a number: 16 when it says nothing, null when it is computed. */
    const iconSizeOf = (node: JSXElement): number | null => {
        const size = literalOf(node, 'size');
        if (size === undefined) {
            return 16;
        }
        return typeof size === 'number' ? size : null;
    };

    const isIconButton = (node: JSXElement): boolean => nameOf(node.openingElement.name) === 'IconButton' || classesOf(node).split(/\s+/).includes('icon-btn');

    /* The icons a button draws itself, not those of a button inside it. */
    const iconsIn = (node: Tree): JSXElement[] =>
        elementsIn(node.children).flatMap((child) => {
            if (child.type === 'JSXElement' && nameOf(child.openingElement.name) === 'Icon') {
                return [child];
            }
            if (child.type === 'JSXElement' && isIconButton(child)) {
                return [];
            }
            return iconsIn(child);
        });

    /* The icon an icon button of this element's size draws, or null when the size is chosen at run time. */
    const expectedIconOf = (node: JSXElement): number | null => {
        if (nameOf(node.openingElement.name) === 'IconButton') {
            const size = literalOf(node, 'size');
            if (size === undefined) {
                return ICON_BUTTON_ICON_SIZE.md;
            }
            return typeof size === 'string' && size in ICON_BUTTON_ICON_SIZE ? ICON_BUTTON_ICON_SIZE[size as IconButtonSize] : null;
        }
        const modifiers = classesOf(node)
            .split(/\s+/)
            .filter((utility) => utility in ICON_IN_BUTTON);
        if (modifiers.length > 1) {
            return null;
        }
        return modifiers.length === 1 ? (ICON_IN_BUTTON[modifiers[0] as string] ?? null) : ICON_BUTTON_ICON_SIZE.md;
    };

    const jsxElements = (path: string, text: string): JSXElement[] =>
        nodesIn(programOf(path, text)).filter((node): node is JSXElement => node.type === 'JSXElement');

    const tsx = () => pageSources().filter(({ path }) => path.endsWith('.tsx'));
    const checks: [DesignRule, string, () => string[]][] = [
        [
            'keyListeners',
            'a key is heard on the window only where a shortcut may be bound',
            () => {
                const listening = pageSources()
                    .filter(({ text }) => /(window|document)\.addEventListener\(\s*['"]key(down|up)['"]/.test(text))
                    .map(({ path }) => path);
                return listening.filter((path) => !options.keyListeners?.includes(path));
            }
        ],
        [
            'typeSize',
            'type comes in the four sizes of the theme, never a size in brackets',
            () => {
                const bracketed = pageSources().flatMap(({ path, text }) => [...text.matchAll(/text-\[\d[^\]]*\]/g)].map((match) => `${path}: ${match[0]}`));
                return bracketed;
            }
        ],
        [
            'uppercase',
            'a label is sentence case, never uppercase',
            () => {
                const shouted = pageSources().flatMap(({ path, text }) =>
                    stringsOf(path, text)
                        .filter(({ classes }) => classes.split(/\s+/).some((utility) => utility.slice(utility.lastIndexOf(':') + 1) === 'uppercase'))
                        .map(({ start }) => `${path}:${lineOf(text, start)}`)
                );
                return shouted;
            }
        ],
        [
            'focusRing',
            'keyboard focus is the accent outline, never a ring or a colored border',
            () => {
                const drawn = pageSources().flatMap(({ path, text }) =>
                    [...text.matchAll(/focus(-visible|-within)?:(ring-|border-accent)/g)].map((match) => `${path}: ${match[0]}`)
                );
                return drawn;
            }
        ],
        [
            'outlineAccent',
            'an outline takes outline-accent-on-surface, which an app keeps readable on its ground, never outline-accent',
            () => {
                const plain = pageSources().flatMap(({ path, text }) =>
                    stringsOf(path, text)
                        .filter(({ classes }) => classes.split(/\s+/).some((utility) => utility.slice(utility.lastIndexOf(':') + 1) === 'outline-accent'))
                        .map(({ start }) => `${path}:${lineOf(text, start)}`)
                );
                return plain;
            }
        ],
        [
            'tooltip',
            'a hint is a Tooltip, never a title on an element',
            () => {
                const titled = pageSources()
                    .filter(({ path }) => path.endsWith('.tsx'))
                    .flatMap(({ path, text }) => {
                        const found: string[] = [];
                        new Visitor({
                            JSXOpeningElement(node) {
                                const intrinsic = node.name.type === 'JSXIdentifier' && /^[a-z]/.test(node.name.name) && !TITLE_AS_NAME.has(node.name.name);
                                if (
                                    intrinsic &&
                                    node.attributes.some(
                                        (attribute) =>
                                            attribute.type === 'JSXAttribute' && attribute.name.type === 'JSXIdentifier' && attribute.name.name === 'title'
                                    )
                                ) {
                                    found.push(`${path}:${lineOf(text, node.start)}`);
                                }
                            }
                        }).visit(programOf(path, text));
                        return found;
                    });
                return titled;
            }
        ],
        [
            'wordButton',
            'a button with a word in it is a Button, never a height, a padding and a radius of its own',
            () => {
                const built = pageSources()
                    .filter(({ path }) => path.endsWith('.tsx') && path !== options.buttonFile)
                    .flatMap(({ path, text }) =>
                        jsxElements(path, text)
                            .filter((node) => nameOf(node.openingElement.name) === 'button')
                            .filter(
                                (node) =>
                                    !node.openingElement.attributes.some(
                                        (attribute) =>
                                            attribute.type === 'JSXAttribute' &&
                                            attribute.name.type === 'JSXIdentifier' &&
                                            ROW_ATTRIBUTES.has(attribute.name.name)
                                    )
                            )
                            .filter((node) => {
                                const classes = classesOf(node);
                                const exempt = /\b(icon-btn|w-\d+|menu-item|cursor-row|text-left)\b/.test(classes);
                                return !exempt && /(^|\s)h-[678](\s|$)/.test(classes) && /\bpx-/.test(classes) && /\brounded-/.test(classes);
                            })
                            .map((node) => `${path}:${lineOf(text, node.start)}`)
                    );
                return built;
            }
        ],
        [
            'iconButtonSize',
            'an icon button is sized by its modifier, never a height, a width or a radius of its own',
            () => {
                const sized = pageSources().flatMap(({ path, text }) =>
                    jsxElements(path, text)
                        .filter(isIconButton)
                        .flatMap((node) => {
                            const own = classesOf(node)
                                .split(/\s+/)
                                .filter((utility) => ICON_BUTTON_SIZE.test(utility.slice(utility.lastIndexOf(':') + 1)));
                            return own.length > 0 ? [`${path}:${lineOf(text, node.start)}: ${own.join(' ')}`] : [];
                        })
                );
                return sized;
            }
        ],
        [
            'iconButtonIcon',
            'an icon button draws the icon of its size',
            () => {
                const mismatched = pageSources()
                    .filter(({ path }) => path.endsWith('.tsx'))
                    .flatMap(({ path, text }) =>
                        jsxElements(path, text)
                            .filter((node) => isIconButton(node) && !classesOf(node).split(/\s+/).includes('w-auto'))
                            .flatMap((button) => {
                                const expected = expectedIconOf(button);
                                if (expected === null) {
                                    return [];
                                }
                                return (
                                    iconsIn(button)
                                        // An icon laid over another drawing, such as the cross inside a toast's timer ring, is part of that drawing.
                                        .filter((icon) => !classesOf(icon).split(/\s+/).includes('absolute'))
                                        .filter((icon) => {
                                            const size = iconSizeOf(icon);
                                            return size !== null && size !== expected;
                                        })
                                        .map((icon) => `${path}:${lineOf(text, icon.start)}: ${iconSizeOf(icon)} where ${expected} belongs`)
                                );
                            })
                    );
                return mismatched;
            }
        ],
        [
            'iconScale',
            'an icon is 12, 14, 16 or 20 pixels, never a size between the steps',
            () => {
                const between = pageSources()
                    .filter(({ path }) => path.endsWith('.tsx'))
                    .flatMap(({ path, text }) =>
                        jsxElements(path, text)
                            .filter((node) => attributeOf(node, 'size') !== undefined)
                            .filter((node) => {
                                const size = iconSizeOf(node);
                                return size !== null && OFF_SCALE_ICON.has(size);
                            })
                            .map((node) => `${path}:${lineOf(text, node.start)}: ${iconSizeOf(node)}`)
                    );
                return between;
            }
        ],
        [
            'intl',
            'only format/ builds a formatter out of Intl',
            () => {
                const building = sources()
                    .filter(({ path }) => options.formatterDirectory === undefined || !path.startsWith(options.formatterDirectory))
                    .filter(({ path }) => !options.intlExempt?.includes(path))
                    .flatMap(({ path, text }) => {
                        const found: string[] = [];
                        new Visitor({
                            MemberExpression(node) {
                                if (node.object.type === 'Identifier' && node.object.name === 'Intl') {
                                    found.push(`${path}:${lineOf(text, node.start)}`);
                                }
                            }
                        }).visit(programOf(path, text));
                        return found;
                    });
                return building;
            }
        ],
        [
            'color',
            'a color is a token of the theme, never a raw value in a component',
            () => {
                const raw = pageSources()
                    .filter(({ path }) => !options.colorExempt?.includes(path))
                    .flatMap(({ path, text }) =>
                        stringsOf(path, text)
                            .filter(({ classes }) => RAW_COLOR.test(classes))
                            .map(({ start }) => `${path}:${lineOf(text, start)}`)
                    );
                return raw;
            }
        ],
        [
            'fractionalPixel',
            'a length is whole pixels: no fractional pixel',
            () => {
                const fractional = pageSources().flatMap(({ path, text }) =>
                    [...text.matchAll(/\[[^\]\s]*\d\.\d+px[^\]\s]*\]/g)].map((match) => `${path}: ${match[0]}`)
                );
                return fractional;
            }
        ],
        [
            'namespace',
            'words are read through useTranslation of the database namespace, never the global i18next',
            () => {
                if (options.namespace === undefined) {
                    return [];
                }
                const wrong = tsx().flatMap(({ path, text }) => [
                    ...[...text.matchAll(/^import (?!type)[^;\n]*from 'i18next'/gm)].map((match) => `${path}: ${match[0]}`),
                    ...(options.namespaceExempt?.includes(path)
                        ? []
                        : [...text.matchAll(new RegExp(`useTranslation\\((?!'${options.namespace}')[^)]*\\)`, 'g'))].map((match) => `${path}: ${match[0]}`))
                ]);
                return wrong;
            }
        ],
        [
            'forwardRef',
            'a component takes its ref as a prop, never through forwardRef',
            () => {
                return tsx()
                    .filter(({ text }) => /\bforwardRef\b/.test(text))
                    .map(({ path }) => path);
            }
        ]
    ];
    const problems = checks
        .filter(([id]) => options.rules === undefined || options.rules.includes(id))
        .flatMap(([, rule, check]) => check().map((location) => ({ rule, location })));
    if (options.theme !== undefined) {
        problems.push(...themeProblemsIn(options.theme));
    }
    return problems;
}

function themeProblemsIn(theme: string): DesignProblem[] {
    const problems: DesignProblem[] = [];
    const add = (rule: string, line = 1): void => {
        problems.push({ rule, location: `theme.css:${line}` });
    };
    const lineOf = (offset: number): number => theme.slice(0, offset).split('\n').length;
    const sizes = [...theme.matchAll(/--text-[a-z0-9]+:\s*((?:round\(|\d)[^;]*);/g)];
    if (sizes.length <= 4) {
        add('the theme defines its type scale');
    }
    for (const match of sizes) {
        const size = match[1]!.trim();
        // The theme leaves the browser root at 16px.
        const rem = /^round\(([\d.]+)rem, 1px\)$/.exec(size);
        const px = /^([\d.]+)px$/.exec(size);
        const pixels = rem ? Math.round(Number(rem[1]) * 16) : px ? Number(px[1]) : Number.NaN;
        if (!(pixels >= 12)) {
            add('the theme sets no type below 12px', lineOf(match.index));
        }
    }
    for (const match of theme.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) {
        if (Number(match[1]) < 12) {
            add('the theme sets no type below 12px', lineOf(match.index));
        }
    }
    const start = theme.indexOf('/* Who floats over whom.');
    if (start === -1) {
        add('the theme separates its tokens from component rules');
    } else {
        for (const match of theme.slice(start).matchAll(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch)\(/g)) {
            const line = lineOf(start + match.index);
            // A mask uses only alpha, so its black is not a visible color.
            if (!theme.split('\n')[line - 1]!.includes('mask-image')) {
                add('a color outside the theme block is a token, never a raw value', line);
            }
        }
    }
    for (const match of theme.matchAll(/\d\.\d+px/g)) {
        add('a length is whole pixels: no fractional pixel', lineOf(match.index));
    }
    for (const [index, source] of theme.split('\n').entries()) {
        const line = source.replace(/\/\*.*?\*\//g, '');
        if (/\d(rem|em)\b/.test(line) && !/round\([\d.]+r?em, 1px\)/.test(line)) {
            add('every rem or em is rounded to whole pixels', index + 1);
        }
    }
    return problems;
}
