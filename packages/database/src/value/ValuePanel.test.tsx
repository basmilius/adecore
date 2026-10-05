import { describe, expect, test } from 'bun:test';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18next from 'i18next';
import { UIProvider } from '@adecore/ui';
import { DatabaseProvider } from '../DatabaseProvider.tsx';
import type { DatabaseClient } from '../client/types.ts';
import type { GridColumn } from '../grid/types.ts';
import { ValuePanel, type ValuePanelProps } from './ValuePanel.tsx';

const i18n = i18next.createInstance();
await i18n.init({ lng: 'en', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false } });

const render = (node: ReactNode): string =>
    renderToStaticMarkup(
        <UIProvider i18n={i18n}>
            <DatabaseProvider client={{} as DatabaseClient}>{node}</DatabaseProvider>
        </UIProvider>
    );

const column = (kind: GridColumn['kind'], extra: Partial<GridColumn> = {}): GridColumn => ({ name: 'body', type: 'TEXT', kind, ...extra });

const panel = (props: Partial<ValuePanelProps>): string =>
    render(<ValuePanel column={column('text')} value="hello" loading={false} editable={false} onClose={() => {}} {...props} />);

describe('ValuePanel', () => {
    test('asks for a cell while none is focused', () => {
        const markup = panel({ column: null, value: undefined });
        expect(markup).toContain('Select a cell to see its value.');
        expect(markup).toContain('aria-label="Close"');
    });

    test('shows a spinner while it loads, and says so when it cannot', () => {
        expect(panel({ value: undefined, loading: true })).toContain('Loading the value');
        expect(panel({ value: undefined })).toContain('The value could not be loaded.');
    });

    test('shows the column, its type, the value and its size', () => {
        const markup = panel({ value: 'one\ntwo' });
        expect(markup).toContain('body');
        expect(markup).toContain('TEXT');
        expect(markup).toContain('one\ntwo');
        expect(markup).toContain('7 characters');
        expect(markup).toContain('aria-label="Copy"');
        expect(markup).not.toContain('role="radiogroup"');
    });

    test('keeps one character singular', () => {
        expect(panel({ value: 'a' })).toContain('1 character<');
    });

    test('reads only when the cell cannot be edited', () => {
        const markup = panel({});
        expect(markup).toContain('readOnly=""');
        expect(markup).not.toContain('>Apply<');
        expect(markup).not.toContain('Set NULL');
    });

    test('offers the actions of an edit when it can, with NULL and DEFAULT behind a menu', () => {
        const markup = panel({ editable: true, onCommit: () => {} });
        expect(markup).toContain('>Apply<');
        expect(markup).toContain('>Revert<');
        expect(markup).toContain('aria-label="More actions"');
    });

    test('has nothing to apply before the draft changes', () => {
        expect(panel({ editable: true, onCommit: () => {} })).toMatch(/disabled=""[^>]*>Apply</);
    });

    test('shows NULL faintly and no size', () => {
        const markup = panel({ value: null });
        expect(markup).toContain('placeholder="NULL"');
        expect(markup).not.toContain('character');
    });

    test('opens JSON formatted, with a Text view beside it', () => {
        const markup = panel({ column: column('json', { type: 'JSON' }), value: '{"a":[1,2]}' });
        expect(markup).toContain('role="radiogroup"');
        expect(markup).toContain('Formatted');
        expect(markup).toContain('&quot;a&quot;: [\n    1,\n    2\n  ]');
    });

    test('opens binary as a hex dump with a UUID view for 16 bytes', () => {
        const markup = panel({ column: column('binary', { type: 'BLOB' }), value: { kind: 'binary', hex: '550e8400e29b41d4a716446655440000' } });
        expect(markup).toContain('00000000  55 0e 84 00 e2 9b 41 d4');
        expect(markup).toContain('>UUID<');
        expect(markup).toContain('16 B');
        expect(panel({ column: column('binary'), value: { kind: 'binary', hex: '0011' } })).not.toContain('>UUID<');
    });

    test('takes hex in the editor of an editable binary value', () => {
        const markup = panel({ column: column('binary'), value: { kind: 'binary', hex: 'abcd' }, editable: true });
        expect(markup).toContain('aria-label="Bytes of body in hex"');
        expect(markup).toContain('>abcd<');
    });
});
