import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { TerminalView } from './TerminalView.tsx';

describe('a terminal view', () => {
    test('is a named region only when it has a label', () => {
        expect(renderToStaticMarkup(<TerminalView label="Build output" />)).toContain('role="region" aria-label="Build output"');
        expect(renderToStaticMarkup(<TerminalView />)).not.toContain('role=');
    });

    test('hands the host to xterm inside the box the caller sizes', () => {
        expect(renderToStaticMarkup(<TerminalView className="grow" />)).toBe('<div class="terminal-view grow"><div class="terminal-view-host"></div></div>');
    });
});
