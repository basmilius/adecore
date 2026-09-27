import { describe, expect, test } from 'bun:test';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18next from 'i18next';
import { X } from 'lucide-react';
import { ButtonGroup } from './ButtonGroup.tsx';
import { ColorSwatch } from './ColorSwatch.tsx';
import { Field, FormError } from './Field.tsx';
import { formatLocale } from './format/locale.ts';
import { IconButton } from './IconButton.tsx';
import { Input, TextArea } from './Input.tsx';
import { Kbd } from './Kbd.tsx';
import { ListRow } from './ListRow.tsx';
import * as Menu from './menu/index.parts.ts';
import { MenuCheck } from './menu/parts.tsx';
import { PanelHeader } from './PanelHeader.tsx';
import { SectionLabel } from './SectionLabel.tsx';
import { SlidingColumn } from './SlidingColumn.tsx';
import { Stepper } from './Stepper.tsx';
import { Surface } from './Surface.tsx';
import { fakeFormatSource } from './testing/fake-source.ts';
import { UIProvider } from './UIProvider.tsx';

const i18n = i18next.createInstance();
await i18n.init({ lng: 'en', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false } });

const render = (node: ReactNode): string => renderToStaticMarkup(<UIProvider i18n={i18n}>{node}</UIProvider>);

describe('an icon button', () => {
    test('draws the icon of its size inside the square of its size', () => {
        const markup = render(<IconButton icon={X} size="sm" label="Close" />);
        expect(markup).toContain('class="icon-btn icon-btn-sm"');
        expect(markup).toContain('width="14"');
        expect(markup).toContain('aria-label="Close"');
    });

    test('is 32 with a 16 icon when it names no size', () => {
        const markup = render(<IconButton icon={X} label="Close" />);
        expect(markup).toContain('class="icon-btn"');
        expect(markup).toContain('width="16"');
    });

    test('hands its icon the classes meant for the icon, at the size of the button', () => {
        const markup = render(<IconButton icon={X} size="xs" label="Play" spin iconClassName="fill-current" />);
        expect(markup).toContain('class="lucide lucide-x align-middle animate-spin fill-current"');
        expect(markup).toContain('width="12"');
        expect(markup).toContain('class="icon-btn icon-btn-xs"');
    });

    test('says it is pressed as a key, and is a plain button without a tooltip', () => {
        const markup = render(<IconButton icon={X} label="Mute" active tooltip={false} />);
        expect(markup).toContain('data-active="true"');
        expect(markup).toContain('type="button"');
    });
});

describe('a color swatch', () => {
    test('wears its color and a ring with a tick once picked', () => {
        const markup = render(<ColorSwatch color="rgb(1 2 3)" picked on="popup" />);
        expect(markup).toContain('background:rgb(1 2 3)');
        expect(markup).toContain('ring-offset-surface-raised');
        expect(markup).toContain('<svg');
    });

    test('keeps its own padding and highlight as a menu item that is no row', () => {
        const markup = render(
            <Menu.Root>
                <ColorSwatch render={<Menu.Item unstyled />} aria-label="None" picked />
            </Menu.Root>
        );
        expect(markup).toContain('role="menuitem"');
        expect(markup).toContain('focus-ring');
        expect(markup).not.toContain('menu-item');
    });

    test('is an outlined circle without a color, and draws what it is handed instead of the tick', () => {
        const markup = render(<ColorSwatch>…</ColorSwatch>);
        expect(markup).toContain('border-border-strong');
        expect(markup).not.toContain('<svg');
        expect(markup).toContain('…');
    });
});

describe('a field', () => {
    test('points its label at the control and describes the control by its hint and its error', () => {
        const markup = render(
            <Field label="Name" hint="Shown in the sidebar" error="Taken">
                <Input />
            </Field>
        );
        const control = /<input id="([^"]+)"/.exec(markup)?.[1];
        expect(control).toBeDefined();
        expect(markup).toContain(`<label for="${control}"`);
        const describedBy = /aria-describedby="([^"]+)"/.exec(markup)?.[1]?.split(' ') ?? [];
        expect(describedBy).toHaveLength(2);
        for (const id of describedBy) {
            expect(markup).toContain(`id="${id}"`);
        }
        expect(markup).toContain('aria-invalid="true"');
        expect(markup).toContain('role="alert"');
    });

    test('names a group with its label when the control is no input, and leaves an input inside it unconnected', () => {
        const markup = render(
            <Field group label="Ground" hint="Behind every frame">
                <Input aria-label="Other" />
            </Field>
        );
        expect(markup).not.toContain('<label');
        const labelledBy = /role="group" aria-labelledby="([^"]+)" aria-describedby="([^"]+)"/.exec(markup);
        expect(labelledBy).not.toBeNull();
        expect(markup).toContain(`<span id="${labelledBy?.[1]}"`);
        expect(markup).toContain(`<p id="${labelledBy?.[2]}"`);
        expect(markup).toContain('<input aria-label="Other" class="field"');
    });

    test('leaves a control outside a field as it is', () => {
        const markup = render(<TextArea rows={3} />);
        expect(markup).not.toContain('aria-describedby');
        expect(markup).toContain('class="field');
    });

    test('draws a text area at the size of an input, without a handle unless it asks for one', () => {
        expect(render(<TextArea aria-label="Note" />)).toContain('class="field h-auto min-h-16 py-1.5 resize-none"');
        expect(render(<TextArea aria-label="Draft" size="sm" resize="vertical" />)).toContain('class="field h-auto min-h-16 py-1.5 field-sm resize-y"');
    });

    test('says what went wrong as an alert', () => {
        expect(render(<FormError>Nope</FormError>)).toBe('<p role="alert" class="text-xs text-status-error">Nope</p>');
    });
});

describe('a menu item', () => {
    const inMenu = (node: ReactNode): string => render(<Menu.Root>{node}</Menu.Root>);

    test('is a row with its indicator unless it asks to be left unstyled', () => {
        expect(inMenu(<Menu.Item>Rename</Menu.Item>)).toContain('class="menu-item"');
        const bare = inMenu(
            <>
                <Menu.Item unstyled className="icon-btn">
                    +
                </Menu.Item>
                <Menu.CheckboxItem unstyled checked className="segment">
                    Wrap
                </Menu.CheckboxItem>
            </>
        );
        expect(bare).not.toContain('menu-item');
        expect(bare).not.toContain('<svg');
        expect(bare).toContain('role="menuitem" tabindex="-1"');
    });

    test('puts its indicator at the end of the row when it asks for it there', () => {
        const markup = inMenu(
            <Menu.CheckboxItem checked indicator="end">
                Fast mode
            </Menu.CheckboxItem>
        );
        expect(markup.indexOf('Fast mode')).toBeLessThan(markup.indexOf('border-border-strong'));
        expect(markup).toContain('ml-auto');
    });

    test('leaves the look of a group label to the group when it is unstyled', () => {
        const markup = inMenu(
            <Menu.Group>
                <Menu.GroupLabel unstyled className="font-medium">
                    Context
                </Menu.GroupLabel>
            </Menu.Group>
        );
        expect(markup).toContain('class="font-medium"');
    });
});

describe('the element a part renders', () => {
    test('is its own tag by default and whatever `render` names otherwise, with the classes of both', () => {
        expect(render(<SectionLabel>Recent</SectionLabel>)).toBe('<span class="text-xs/[inherit] font-medium text-text-faint">Recent</span>');
        expect(render(<SectionLabel render={<h3 className="px-2" />}>Recent</SectionLabel>)).toBe(
            '<h3 class="px-2 text-xs/[inherit] font-medium text-text-faint">Recent</h3>'
        );
        expect(render(<ListRow variant="inset" render={<button type="button" />} />)).toContain('<button type="button" class="flex h-8');
        expect(render(<Surface className="rounded-lg" />)).toContain('rounded-lg');
        expect(render(<ButtonGroup role="group" />)).toBe('<div role="group" class="inline-flex items-center gap-px"></div>');
    });

    test('a panel header names its panel before its own controls', () => {
        const markup = render(
            <PanelHeader title="Files">
                <button type="button">x</button>
            </PanelHeader>
        );
        expect(markup.indexOf('Files')).toBeLessThan(markup.indexOf('<button'));
        expect(markup.startsWith('<header')).toBe(true);
    });
});

describe('a check in a menu row', () => {
    test('shows the tick of a plain row only while it is checked', () => {
        expect(render(<MenuCheck kind="radio" checked />)).toContain('<svg');
        expect(render(<MenuCheck kind="radio" checked={false} />)).not.toContain('<svg');
    });
});

describe('a shortcut chip', () => {
    test('prints what it is handed when it has no shortcut', () => {
        expect(render(<Kbd variant="inline">↑</Kbd>)).toContain('>↑</kbd>');
    });
});

describe('the provider', () => {
    test('adds the words of the library to the app i18next, so a control reads them on its first render', () => {
        const fresh = i18next.createInstance();
        void fresh.init({ lng: 'nl', resources: {} });
        const markup = renderToStaticMarkup(
            <UIProvider i18n={fresh}>
                <Stepper value={2} onValueChange={() => {}} min={0} max={4} step={1} label="Rand" />
            </UIProvider>
        );
        expect(fresh.hasResourceBundle('en', 'ui')).toBe(true);
        expect(markup).toContain('aria-label="Rand: kleiner"');
    });

    test('hands the formatters their source before the children format anything', () => {
        const source = fakeFormatSource();
        source.set({ region: 'nl-NL' });
        let seen = '';
        const Probe = () => {
            seen = formatLocale();
            return null;
        };
        renderToStaticMarkup(
            <UIProvider i18n={i18n} formatSource={source}>
                <Probe />
            </UIProvider>
        );
        expect(seen).toBe('nl-NL');
    });
});

describe('a sliding column', () => {
    const renderColumn = (open: boolean, instant: boolean): string =>
        render(
            <SlidingColumn open={open} instant={instant} width={380} bounds={{ min: 320, max: () => 800 }} onWidthChange={() => {}}>
                Panel
            </SlidingColumn>
        );

    test('lands without the motion while its width is being restored', () => {
        expect(renderColumn(true, true)).toContain('data-instant=""');
    });

    test('keeps the motion otherwise, open and closed', () => {
        for (const open of [true, false]) {
            const markup = renderColumn(open, false);
            expect(markup).not.toContain('data-instant');
            expect(markup).toContain('sliding-column');
            expect(markup).toContain(`width:${open ? '380px' : '0'}`);
        }
    });
});
