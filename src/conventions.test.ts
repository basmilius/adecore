import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Glob } from 'bun';
import { describe, expect, test } from 'bun:test';
import { parseSync, Visitor, type JSXElement, type JSXElementName, type JSXFragment, type Program } from 'oxc-parser';
import { ICON_BUTTON_CLASS, ICON_BUTTON_ICON_SIZE, type IconButtonSize } from './icon-button-size.ts';

const HERE = new URL('.', import.meta.url).pathname;

const sources = (): { path: string; text: string }[] =>
    [...new Glob('**/*.{ts,tsx}').scanSync(HERE)]
        .filter((path) => !path.endsWith('.test.ts') && !path.endsWith('.test.tsx'))
        .sort()
        .map((path) => ({ path, text: readFileSync(join(HERE, path), 'utf8') }));

const THEME = readFileSync(join(HERE, 'theme.css'), 'utf8');

/* Where a key may be heard on the window, and why there. */
const KEY_LISTENERS: Record<string, string> = {
    'ShortcutHints.tsx': 'mounted once, and only watches a modifier held on its own; it binds no shortcut',
    'modality.ts': 'started once, and only notes that the keyboard is in use; it binds no shortcut'
};

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

/* Every node under one, in the order of the source. */
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

/* Every class a `className` can carry, from a plain string, a template or the arguments of `clsx`. */
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

/* Every string in a file, as the classes it may carry. */
const stringsOf = (path: string, text: string): { classes: string; start: number }[] =>
    nodesIn(programOf(path, text)).flatMap((node) =>
        node.type === 'Literal' || node.type === 'TemplateElement' ? [{ classes: classesIn([node]), start: (node as unknown as { start: number }).start }] : []
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

describe('the conventions of the library', () => {
    test('a key is heard on the window only where a shortcut may be bound', () => {
        const listening = sources()
            .filter(({ text }) => /(window|document)\.addEventListener\(\s*['"]key(down|up)['"]/.test(text))
            .map(({ path }) => path);
        expect(listening.filter((path) => !(path in KEY_LISTENERS))).toEqual([]);
    });

    test('type comes in the four sizes of the theme, never a size in brackets', () => {
        const bracketed = sources().flatMap(({ path, text }) => [...text.matchAll(/text-\[\d[^\]]*\]/g)].map((match) => `${path}: ${match[0]}`));
        expect(bracketed).toEqual([]);
    });

    test('the theme sets no type below 12px', () => {
        // The type scale, not the colors that share the prefix.
        const sizes = [...THEME.matchAll(/--text-[a-z0-9]+:\s*((?:round\(|\d)[^;]*);/g)].map((match) => match[1]!.trim());
        // A rem is read against the browser's own root of 16px, which the theme leaves alone.
        const pixels = sizes.map((size) => {
            const rem = /^round\(([\d.]+)rem, 1px\)$/.exec(size);
            if (rem) {
                return Math.round(Number(rem[1]) * 16);
            }
            const px = /^([\d.]+)px$/.exec(size);
            return px ? Number(px[1]) : Number.NaN;
        });
        expect(sizes.length).toBeGreaterThan(4);
        expect(pixels.filter((pixel) => !(pixel >= 12))).toEqual([]);
        expect([...THEME.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((match) => Number(match[1])).filter((pixel) => pixel < 12)).toEqual([]);
    });

    test('a label is sentence case, never uppercase', () => {
        const shouted = sources().flatMap(({ path, text }) =>
            stringsOf(path, text)
                .filter(({ classes }) => classes.split(/\s+/).some((utility) => utility.slice(utility.lastIndexOf(':') + 1) === 'uppercase'))
                .map(({ start }) => `${path}:${lineOf(text, start)}`)
        );
        expect(shouted).toEqual([]);
    });

    test('keyboard focus is the accent outline, never a ring or a colored border', () => {
        const drawn = sources().flatMap(({ path, text }) =>
            [...text.matchAll(/focus(-visible|-within)?:(ring-|border-accent)/g)].map((match) => `${path}: ${match[0]}`)
        );
        expect(drawn).toEqual([]);
    });

    test('a hint is a Tooltip, never a title on an element', () => {
        const titled = sources()
            .filter(({ path }) => path.endsWith('.tsx'))
            .flatMap(({ path, text }) => {
                const found: string[] = [];
                new Visitor({
                    JSXOpeningElement(node) {
                        const intrinsic = node.name.type === 'JSXIdentifier' && /^[a-z]/.test(node.name.name) && !TITLE_AS_NAME.has(node.name.name);
                        if (
                            intrinsic &&
                            node.attributes.some(
                                (attribute) => attribute.type === 'JSXAttribute' && attribute.name.type === 'JSXIdentifier' && attribute.name.name === 'title'
                            )
                        ) {
                            found.push(`${path}:${lineOf(text, node.start)}`);
                        }
                    }
                }).visit(programOf(path, text));
                return found;
            });
        expect(titled).toEqual([]);
    });

    test('a button with a word in it is a Button, never a height, a padding and a radius of its own', () => {
        const built = sources()
            .filter(({ path }) => path.endsWith('.tsx') && path !== 'Button.tsx')
            .flatMap(({ path, text }) =>
                jsxElements(path, text)
                    .filter((node) => nameOf(node.openingElement.name) === 'button')
                    .filter(
                        (node) =>
                            !node.openingElement.attributes.some(
                                (attribute) =>
                                    attribute.type === 'JSXAttribute' && attribute.name.type === 'JSXIdentifier' && ROW_ATTRIBUTES.has(attribute.name.name)
                            )
                    )
                    .filter((node) => {
                        const classes = classesOf(node);
                        const exempt = /\b(icon-btn|w-\d+|menu-item|cursor-row|text-left)\b/.test(classes);
                        return !exempt && /(^|\s)h-[678](\s|$)/.test(classes) && /\bpx-/.test(classes) && /\brounded-/.test(classes);
                    })
                    .map((node) => `${path}:${lineOf(text, node.start)}`)
            );
        expect(built).toEqual([]);
    });

    test('an icon button is sized by its modifier, never a height, a width or a radius of its own', () => {
        const sized = sources().flatMap(({ path, text }) =>
            jsxElements(path, text)
                .filter(isIconButton)
                .flatMap((node) => {
                    const own = classesOf(node)
                        .split(/\s+/)
                        .filter((utility) => ICON_BUTTON_SIZE.test(utility.slice(utility.lastIndexOf(':') + 1)));
                    return own.length > 0 ? [`${path}:${lineOf(text, node.start)}: ${own.join(' ')}`] : [];
                })
        );
        expect(sized).toEqual([]);
    });

    test('an icon button draws the icon of its size', () => {
        const mismatched = sources()
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
        expect(mismatched).toEqual([]);
    });

    test('an icon is 12, 14, 16 or 20 pixels, never a size between the steps', () => {
        const between = sources()
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
        expect(between).toEqual([]);
    });

    test('only format/ builds a formatter out of Intl', () => {
        const building = sources()
            .filter(({ path }) => !path.startsWith('format/'))
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
        expect(building).toEqual([]);
    });

    test('a color is a token of the theme, never a raw value in a component', () => {
        const raw = sources().flatMap(({ path, text }) =>
            stringsOf(path, text)
                .filter(({ classes }) => /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab)\(/.test(classes))
                .map(({ start }) => `${path}:${lineOf(text, start)}`)
        );
        expect(raw).toEqual([]);
    });

    test('a color outside the theme block is a token, never a raw value', () => {
        // The tokens are the two blocks that set them; every rule under them reads a token.
        const rules = THEME.slice(THEME.indexOf('/* Who floats over whom.'));
        const raw = [...rules.matchAll(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch)\(/g)].map((match) =>
            lineOf(THEME, THEME.indexOf(rules) + (match.index ?? 0))
        );
        // `#000` in a mask is not a color anyone sees: only its alpha counts.
        expect(raw.filter((line) => !THEME.split('\n')[line - 1]!.includes('mask-image'))).toEqual([]);
    });

    test('a length is whole pixels: no fractional pixel, and every rem or em rounded to one', () => {
        const fractional = [
            ...sources().flatMap(({ path, text }) => [...text.matchAll(/\[[^\]\s]*\d\.\d+px[^\]\s]*\]/g)].map((match) => `${path}: ${match[0]}`)),
            ...[...THEME.matchAll(/\d\.\d+px/g)].map((match) => `theme.css: ${match[0]}`)
        ];
        expect(fractional).toEqual([]);
        const unrounded = THEME.split('\n')
            .map((line, index) => ({ line: line.replace(/\/\*.*?\*\//g, ''), index }))
            .filter(({ line }) => /\d(rem|em)\b/.test(line) && !/round\([\d.]+r?em, 1px\)/.test(line))
            .map(({ index }) => `theme.css:${index + 1}`);
        expect(unrounded).toEqual([]);
    });
});
