import { describe, expect, test } from 'bun:test';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { errorMessageOf, errorReport } from './error-boundary.ts';

describe('ErrorBoundary state', () => {
    const boundary = (resetKeys: unknown[]): { instance: ErrorBoundary; states: unknown[] } => {
        const instance = new ErrorBoundary({ label: 'This view failed to render', resetKeys, children: null });
        const states: unknown[] = [];

        instance.setState = ((next: object) => {
            states.push(next);
            instance.state = { ...instance.state, ...next };
        }) as ErrorBoundary['setState'];

        return { instance, states };
    };

    test('an error thrown below marks the boundary failed', () => {
        const error = new Error('boom');
        expect(ErrorBoundary.getDerivedStateFromError(error)).toEqual({ error, failed: true });
    });

    test('Try again clears the error so the child draws again', () => {
        const { instance } = boundary([]);
        instance.state = { error: new Error('boom'), failed: true, componentStack: null };
        instance.reset();
        expect(instance.state.failed).toBe(false);
    });

    test('resets only a failed boundary whose keys changed', () => {
        const view = { id: 'v1' };

        const cases: [string, boolean, unknown[], unknown[], boolean][] = [
            ['healthy', false, ['a', 1], ['b', 2], false],
            ['changed value', true, ['v1', 4], ['v1', 5], true],
            ['changed reference', true, [view], [{ id: 'v1' }], true],
            ['same keys', true, ['v1', view, 4], ['v1', view, 4], false],
            ['empty keys', true, [], [], false],
            ['same NaN', true, [Number.NaN], [Number.NaN], false],
            ['added key', true, ['v1'], ['v1', 1], true],
            ['removed key', true, ['v1', 1], ['v1'], true]
        ];

        for (const [name, failed, previous, next, reset] of cases) {
            const { instance, states } = boundary(next);
            instance.state = { error: failed ? new Error('boom') : null, failed, componentStack: null };
            instance.componentDidUpdate({ label: 'x', resetKeys: previous, children: null });
            expect(states, name).toHaveLength(reset ? 1 : 0);
            expect(instance.state.failed, name).toBe(failed && !reset);
        }
    });
});

describe('the message', () => {
    test('says something for anything that can be thrown', () => {
        expect(errorMessageOf(new TypeError("Cannot read properties of undefined (reading 'x')"))).toBe("Cannot read properties of undefined (reading 'x')");
        expect(errorMessageOf('plain')).toBe('plain');
        expect(errorMessageOf(undefined)).toBe('undefined');
    });

    test('the report carries the label, the stack and the component stack', () => {
        const error = new Error('boom');
        const report = errorReport('This node failed to render', error, '\n    at DiagramView');
        expect(report).toStartWith('This node failed to render\n\nError: boom');
        expect(report).toContain('Component stack:\n    at DiagramView');
        expect(errorReport('x', 'plain', null)).toBe('x\n\nplain');
    });
});
