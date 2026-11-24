import { describe, expect, test } from 'bun:test';
import { CircleAlert } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Banner } from './Banner.tsx';
import { Button } from './Button.tsx';
import { EmptyState } from './EmptyState.tsx';
import { Field, FormError } from './Field.tsx';

// The classes of the element whose own text is the given words.
const classesAround = (markup: string, text: string): string[] => {
    const match = markup.match(new RegExp(`<(\\w+)[^>]* class="([^"]*)"[^>]*>${text}</\\1>`));

    return match === null ? [] : match[2]!.split(' ');
};

describe('a message', () => {
    test('lets a person select the error of a form and of a field', () => {
        expect(classesAround(renderToStaticMarkup(<FormError>Name taken.</FormError>), 'Name taken.')).toContain('select-text');

        const markup = renderToStaticMarkup(
            <Field label="Name" error="Name taken.">
                <input />
            </Field>
        );
        expect(classesAround(markup, 'Name taken.')).toContain('select-text');
    });

    test('lets a person select the title and sentence of an empty state, but not its action', () => {
        const markup = renderToStaticMarkup(
            <EmptyState title="No runs" action={<Button>Start</Button>}>
                Start one to see it here.
            </EmptyState>
        );

        expect(classesAround(markup, 'No runs')).toContain('select-text');
        expect(classesAround(markup, 'Start one to see it here.')).toContain('select-text');
        expect(markup.match(/<button[^>]*>/)![0]).not.toContain('select-text');
    });

    test('lets a person select the line of a banner, but not its buttons', () => {
        const markup = renderToStaticMarkup(
            <Banner icon={CircleAlert} tone="error" message="Push failed.">
                <Button>Retry</Button>
            </Banner>
        );

        expect(classesAround(markup, 'Push failed.')).toContain('select-text');
        expect(markup.match(/<button[^>]*>/)![0]).not.toContain('select-text');
    });
});
