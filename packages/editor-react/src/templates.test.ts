import { describe, expect, test } from 'bun:test';
import { familiesOf, templateApplies } from './template-context.ts';
import { BUILT_IN_LIVE_TEMPLATES, TemplateRegistry, checkTemplate, type LiveTemplate, type PostfixTemplate } from './templates.ts';

const log: LiveTemplate = { id: 'own.log', key: 'lg', body: 'console.log($0);', languages: ['javascript'] };
const postfix: PostfixTemplate = { id: 'own.if', key: 'if', body: 'if ($EXPR) {\n\t$0\n}', languages: ['javascript'], expression: 'statement' };

describe('TemplateRegistry', () => {
    test('lists the built-in templates and then the ones of the host', () => {
        const registry = new TemplateRegistry();

        registry.set({ live: [log] });

        expect(registry.live).toEqual([...BUILT_IN_LIVE_TEMPLATES, log]);
    });

    test('has no built-in templates when asked', () => {
        const registry = new TemplateRegistry({ builtins: false });

        registry.set({ live: [log] });

        expect(registry.live).toEqual([log]);
    });

    test('drops the built-in templates that are disabled', () => {
        const registry = new TemplateRegistry();

        registry.set({ disabled: ['builtin.javascript.log'] });

        expect(registry.live.map((template) => template.id)).not.toContain('builtin.javascript.log');
        expect(registry.live).toHaveLength(BUILT_IN_LIVE_TEMPLATES.length - 1);
    });

    test('drops a template that fails the check and keeps a duplicate key', () => {
        const registry = new TemplateRegistry({ builtins: false });

        registry.set({
            live: [log, { ...log, id: 'broken', key: 'a b' }, { ...log, id: 'twin' }],
            postfix: [postfix, { ...postfix, id: 'broken', key: 'a.b' }]
        });

        expect(registry.live.map((template) => template.id)).toEqual(['own.log', 'twin']);
        expect(registry.postfix).toEqual([postfix]);
    });

    test('keeps what an update leaves out and reads the settings as on unless false', () => {
        const registry = new TemplateRegistry({ builtins: false });

        registry.set({ live: [log], settings: { postfix: false } });
        registry.set({ disabled: [] });

        expect(registry.live).toEqual([log]);
        expect(registry.settings).toEqual({ liveInCompletion: true, postfix: false, postfixInCompletion: true });
    });

    test('tells a listener about every update until it stops', () => {
        const registry = new TemplateRegistry();
        let calls = 0;
        const stop = registry.onChange(() => calls++);

        registry.set({ live: [log] });
        stop();
        registry.set({ live: [] });

        expect(calls).toBe(1);
    });
});

describe('checkTemplate', () => {
    test('accepts the built-in templates', () => {
        expect(BUILT_IN_LIVE_TEMPLATES.map((template) => checkTemplate(template))).toEqual(BUILT_IN_LIVE_TEMPLATES.map(() => null));
    });

    test('names what is wrong', () => {
        expect(checkTemplate({ ...log, key: '' })).toBe('The key is one to 40 characters.');
        expect(checkTemplate({ ...log, key: 'a b' })).toBe('The key holds no whitespace.');
        expect(checkTemplate({ ...log, body: ' ' })).toBe('The text is empty.');
        expect(checkTemplate({ ...log, languages: [] })).toBe('The languages are empty or not known.');
        expect(checkTemplate({ ...log, places: ['everywhere' as never] })).toBe('The places are not known.');
        expect(checkTemplate({ ...log, body: '${1/abc} tail' })).toBe('A transform in the text is not valid.');
    });

    test('holds a postfix key to identifier characters and its languages to the three it supports', () => {
        expect(checkTemplate({ ...postfix, key: 'a.b' })).toBe('The key holds letters, digits, underscores and dollar signs only.');
        expect(checkTemplate({ ...postfix, languages: ['css' as never] })).toBe('The languages are empty or not known.');
        expect(checkTemplate({ ...log, key: 'a.b' }, 'live')).toBeNull();
        expect(checkTemplate({ ...log, key: 'a.b' }, 'postfix')).not.toBeNull();
    });
});

describe('template context', () => {
    test('maps a language id to its families', () => {
        expect(familiesOf('typescriptreact')).toEqual(['javascript', 'typescript']);
        expect(familiesOf('vue')).toEqual(['html']);
        expect(familiesOf('plaintext')).toEqual(['other']);
    });

    test('applies a template that shares a family and place with the context', () => {
        const context = { families: familiesOf('typescript'), place: 'code' } as const;

        expect(templateApplies(log, context)).toBe(true);
        expect(templateApplies({ ...log, languages: ['php'] }, context)).toBe(false);
        expect(templateApplies({ ...log, places: ['comment'] }, context)).toBe(false);
        expect(templateApplies({ ...log, places: ['comment', 'code'] }, context)).toBe(true);
    });
});
