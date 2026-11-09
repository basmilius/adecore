import { expect, test } from 'bun:test';
import { designProblemsIn, type DesignOptions } from './design-conventions.ts';

const cases: [string, string, DesignOptions, string][] = [
    ['global shortcut', "window.addEventListener('keydown', listener)", {}, 'a key is heard'],
    ['off-scale type', '<div className="text-[11px]" />', {}, 'type comes'],
    ['uppercase label', '<div className="hover:uppercase" />', {}, 'a label is sentence case'],
    ['focus ring', '<div className="focus-visible:ring-2" />', {}, 'keyboard focus'],
    ['plain accent outline', '<div className="focus-visible:outline-2 focus-visible:outline-accent" />', {}, 'an outline takes'],
    ['native tooltip', '<button title="Run" />', {}, 'a hint is a Tooltip'],
    ['custom word button', '<button className="h-8 px-2 rounded-lg">Run</button>', {}, 'a button with a word'],
    ['custom icon button size', '<IconButton className="w-8" />', {}, 'an icon button is sized'],
    ['mismatched icon', '<button className="icon-btn icon-btn-sm"><Icon size={16} /></button>', {}, 'an icon button draws'],
    ['off-scale icon', '<Icon size={18} />', {}, 'an icon is 12'],
    ['raw formatter', 'new Intl.NumberFormat()', {}, 'only format/'],
    ['raw color', '<div className="text-[#ffffff]" />', {}, 'a color is a token'],
    ['fractional pixel', '<div className="w-[1.5px]" />', {}, 'a length is whole pixels'],
    ['global translations', "import i18next from 'i18next';", { namespace: 'database' }, 'words are read'],
    ['wrong namespace', "useTranslation('ui')", { namespace: 'database' }, 'words are read'],
    ['legacy ref', 'forwardRef(Component)', {}, 'a component takes its ref']
];

test.each(cases)('rejects %s', (_name, text, options, rule) => {
    const problems = designProblemsIn([{ path: 'Component.tsx', text }], options);
    expect(problems.some((problem) => problem.rule.startsWith(rule))).toBe(true);
    expect(problems.every((problem) => problem.location.startsWith('Component.tsx'))).toBe(true);
});

test('permits named frames, token colors, row buttons, and nested or overlaid icons', () => {
    const text = `<><iframe title="Preview" /><div className="text-accent focus:outline-accent-on-surface" />
        <button role="checkbox" className="h-8 px-2 rounded-lg" />
        <button className="icon-btn icon-btn-sm"><IconButton size="md"><Icon /></IconButton><Icon className="absolute" size={12} /><Icon size={14} /></button></>`;
    expect(designProblemsIn([{ path: 'Component.tsx', text }])).toEqual([]);
});

test('keeps formatter and provider exemptions specific to their package and file', () => {
    const sources = [
        { path: 'format/number.ts', text: 'new Intl.NumberFormat()' },
        { path: 'Provider.tsx', text: 'useTranslation()' },
        { path: 'host/daemon.ts', text: "window.addEventListener('keydown', listener)" }
    ];
    expect(
        designProblemsIn(sources, { formatterDirectory: 'format/', namespace: 'database', namespaceExempt: ['Provider.tsx'], pageExclusions: ['host/'] })
    ).toEqual([]);
    expect(designProblemsIn(sources, { namespace: 'database' }).map((problem) => problem.rule)).toHaveLength(3);
});

test('exempts from the color rule only the files named for it', () => {
    const sources = [
        { path: 'logic/ansi.ts', text: "const color = 'rgb(255 0 0)';" },
        { path: 'Component.tsx', text: '<div className="text-[#ffffff]" />' }
    ];
    expect(designProblemsIn(sources, { colorExempt: ['logic/ansi.ts'] }).map((problem) => problem.location)).toEqual(['Component.tsx:1']);
});

test('reads a color given as a token, or a hash that is no color, as no raw color', () => {
    const text = `<div className="bg-[rgb(var(--x))] text-[oklch(from var(--accent) l c h)]" data-id="#pull-request" />`;
    expect(designProblemsIn([{ path: 'Component.tsx', text }], { rules: ['color'] })).toEqual([]);
});

test.each(['lab(50 40 30)', '#abcd', '#12345678'])('rejects the raw color %s', (color) => {
    expect(designProblemsIn([{ path: 'Component.tsx', text: `const paint = '${color}';` }], { rules: ['color'] })).toHaveLength(1);
});

test('runs only the rules asked for', () => {
    const text = '<button title="Run" className="text-[11px]" />';
    expect(designProblemsIn([{ path: 'Component.tsx', text }], { rules: ['tooltip'] }).map((problem) => problem.rule)).toEqual([
        'a hint is a Tooltip, never a title on an element'
    ]);
    expect(designProblemsIn([{ path: 'Component.tsx', text }], { rules: ['color'] })).toEqual([]);
});

test('lets a file outside the formatter folder use Intl when named for it', () => {
    const sources = [
        { path: 'voice/controller.ts', text: 'new Intl.DateTimeFormat()' },
        { path: 'chat/row.ts', text: 'new Intl.DateTimeFormat()' }
    ];
    expect(designProblemsIn(sources, { intlExempt: ['voice/controller.ts'] }).map((problem) => problem.location)).toEqual(['chat/row.ts:1']);
});

test('reports invalid theme type, colors and lengths while permitting alpha masks', () => {
    const scale = '--text-xs: 12px; --text-sm: 14px; --text-md: 16px; --text-lg: 20px; --text-xl: round(2rem, 1px);';
    const theme = `${scale}\n/* Who floats over whom. */\n.mask { mask-image: linear-gradient(#000, #000); }`;
    expect(designProblemsIn([], { theme })).toEqual([]);
    const invalid = `${theme}\n.bad { font-size: 11px; color: #ffffff; width: 1.5px; height: 2rem; }`;
    const rules = designProblemsIn([], { theme: invalid }).map((problem) => problem.rule);
    expect(rules).toEqual([
        'the theme sets no type below 12px',
        'a color outside the theme block is a token, never a raw value',
        'a length is whole pixels: no fractional pixel',
        'every rem or em is rounded to whole pixels'
    ]);
});
