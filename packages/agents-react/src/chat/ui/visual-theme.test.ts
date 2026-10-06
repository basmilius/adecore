import { describe, expect, test } from 'bun:test';
import { VISUAL_THEME_VARIABLES } from '@adecore/agent-contracts/visual';
import { backgroundBehind, visualThemeOf, type VisualTokens } from './visual-theme';

/* The light tokens of the theme as the engine would compute them. */
const LIGHT: Record<string, string> = {
    '--text': 'rgb(24, 24, 27)',
    '--text-muted': 'rgb(111, 111, 120)',
    '--surface': 'rgb(255, 255, 255)',
    '--surface-hover': 'rgb(243, 243, 245)',
    '--surface-raised': 'rgb(255, 255, 255)',
    '--border': 'rgba(0, 0, 0, 0.11)',
    '--border-strong': 'rgba(0, 0, 0, 0.2)',
    '--accent': 'rgb(21, 93, 252)',
    '--accent-text': 'rgb(255, 255, 255)',
    '--status-error': 'rgb(220, 38, 38)',
    '--status-needs-you': 'rgb(217, 119, 6)',
    '--status-running': 'rgb(37, 99, 235)',
    '--positive': 'rgb(21, 128, 61)',
    '--positive-text': 'rgb(255, 255, 255)',
    '--chat-code-bg': 'rgb(236, 236, 239)',
    '--chat-output': 'rgb(24, 24, 27)',
    '--chart-1': 'rgb(21, 93, 252)',
    '--chart-2': 'rgb(235, 104, 52)',
    '--chart-3': 'rgb(27, 175, 122)',
    '--chart-4': 'rgb(237, 161, 0)',
    '--chart-5': 'rgb(232, 123, 164)',
    '--chart-6': 'rgb(0, 131, 0)',
    '--radius-lg': '8px',
    '--font-sans': '-apple-system, "Segoe UI", sans-serif',
    '--font-mono': 'ui-monospace, monospace'
};

function tokens(values: Record<string, string>): VisualTokens {
    const read = (token: string): string => values[token] ?? '';
    return { color: read, length: read, value: read };
}

describe('visualThemeOf', () => {
    test("maps every variable a page knows onto the app's tokens", () => {
        const theme = visualThemeOf(tokens(LIGHT), 'light', 'rgb(250, 250, 250)');
        expect(theme.appearance).toBe('light');
        const missing = VISUAL_THEME_VARIABLES.filter((name) => !(name in theme.variables));
        // Text on a warning or an info color has no token of its own, so the page's default stays.
        expect(missing).toEqual(['--warning-foreground', '--info-foreground']);
        expect(theme.variables).toMatchObject({
            '--background': 'rgb(250, 250, 250)',
            '--foreground': LIGHT['--text'],
            '--muted': LIGHT['--surface-hover'],
            '--muted-foreground': LIGHT['--text-muted'],
            '--card': LIGHT['--surface-raised'],
            '--border': LIGHT['--border'],
            '--input': LIGHT['--border-strong'],
            '--destructive': LIGHT['--status-error'],
            '--warning': LIGHT['--status-needs-you'],
            '--success': LIGHT['--positive'],
            '--info': LIGHT['--status-running'],
            '--code-background': LIGHT['--chat-code-bg'],
            '--chart-6': LIGHT['--chart-6'],
            '--radius': '8px',
            '--font-sans': LIGHT['--font-sans']
        });
    });

    test('the accent stands out as the primary, the ring and the first series, while the accent of a page stays a quiet ground', () => {
        const { variables } = visualThemeOf(tokens(LIGHT), 'light', 'white');
        expect(variables['--primary']).toBe(LIGHT['--accent']);
        expect(variables['--primary-foreground']).toBe(LIGHT['--accent-text']);
        expect(variables['--ring']).toBe(LIGHT['--accent']);
        expect(variables['--chart-1']).toBe(LIGHT['--accent']);
        expect(variables['--accent']).toBe(LIGHT['--surface-hover']);
    });

    test('a token the app does not set leaves the variable to the default of the page, and the first series to the accent', () => {
        const { '--chart-1': _first, '--chart-2': _second, ...rest } = LIGHT;
        const { variables } = visualThemeOf(tokens(rest), 'dark', 'black');
        expect(variables['--chart-1']).toBe(LIGHT['--accent']);
        expect('--chart-2' in variables).toBe(false);
    });

    test('drops a value that could break out of its rule', () => {
        const { variables } = visualThemeOf(tokens({ ...LIGHT, '--font-sans': 'x; } html { display: none' }), 'light', 'white');
        expect('--font-sans' in variables).toBe(false);
    });
});

describe('backgroundBehind', () => {
    test('takes the nearest ground that paints, past every transparent one', () => {
        expect(backgroundBehind(['rgba(0, 0, 0, 0)', 'transparent', 'rgb(19, 19, 22)', 'rgb(255, 255, 255)'])).toBe('rgb(19, 19, 22)');
    });

    test('lays a translucent ground over the one under it', () => {
        expect(backgroundBehind(['rgba(255, 255, 255, 0.5)', 'rgba(0, 0, 0, 0)', 'rgb(0, 0, 0)'])).toBe('rgb(128, 128, 128)');
        expect(backgroundBehind(['rgb(0 0 0 / 50%)', 'rgb(200, 100, 50)'])).toBe('rgb(100, 50, 25)');
    });

    test('keeps a color in another space as the engine wrote it', () => {
        expect(backgroundBehind(['oklch(0.2 0 0)'])).toBe('oklch(0.2 0 0)');
    });

    test('is null when nothing paints', () => {
        expect(backgroundBehind(['rgba(0, 0, 0, 0)', ''])).toBeNull();
    });
});
