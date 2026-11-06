import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { CopyButton } from './CopyButton.tsx';

describe('a copy button', () => {
    test('is an icon named after what it copies, or a button with the word', () => {
        expect(renderToStaticMarkup(<CopyButton text="dsn" />)).toContain('aria-label="Copy"');
        expect(renderToStaticMarkup(<CopyButton text="dsn" label="Copy DSN" />)).toContain('aria-label="Copy DSN"');
        const labeled = renderToStaticMarkup(<CopyButton text="output" label="Copy output" showLabel />);
        expect(labeled).not.toContain('aria-label');
        expect(labeled).toContain('Copy output</button>');
    });
});
