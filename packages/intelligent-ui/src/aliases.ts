import type { UiComponentName } from './catalog.ts';

/* A name an agent writes for a component that has another one, read as that one. */
export const UI_COMPONENT_ALIASES: Readonly<Record<string, UiComponentName>> = { Badge: 'Tag', Pill: 'Tag', Status: 'Tag', Chip: 'Tag' };

/* Per prop, the words an agent writes for one of its values, in lower case, read as that value where the written word is none of them. */
export const UI_VALUE_ALIASES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
    tone: {
        error: 'danger',
        critical: 'danger',
        destructive: 'danger',
        failed: 'danger',
        negative: 'danger',
        bad: 'danger',
        warn: 'warning',
        caution: 'warning',
        ok: 'success',
        positive: 'success',
        good: 'success',
        passed: 'success',
        default: 'neutral',
        muted: 'neutral',
        primary: 'info',
        note: 'info'
    },
    state: {
        active: 'running',
        in_progress: 'running',
        'in-progress': 'running',
        current: 'running',
        complete: 'done',
        completed: 'done',
        success: 'done',
        finished: 'done',
        error: 'failed',
        todo: 'pending',
        waiting: 'pending',
        queued: 'pending',
        skip: 'skipped'
    },
    kind: { column: 'bar', columns: 'bar', bars: 'bar', horizontal: 'hbar', stack: 'stacked', lines: 'line' },
    as: {
        string: 'text',
        int: 'number',
        integer: 'number',
        float: 'number',
        size: 'bytes',
        time: 'duration',
        datetime: 'date',
        path: 'file',
        badge: 'tag',
        status: 'tag'
    }
};

/* The props an agent writes for the words a component takes between its tags. */
export const UI_TEXT_PROPS: readonly string[] = ['label', 'title', 'value', 'caption', 'name', 'text'];
