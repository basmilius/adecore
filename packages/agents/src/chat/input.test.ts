import { describe, expect, test } from 'bun:test';
import { buildUserMessage, lastSkillToken, splitSkillPrompt } from './input.ts';

const png = { id: 'a1', name: 'shot.png', mime: 'image/png', size: 12, path: '/home/x/.ruimte/attachments/chat-1/a1.png' };

describe('buildUserMessage', () => {
    test('text alone is one text block in a user frame', () => {
        expect(buildUserMessage({ text: 'hello' })).toEqual({
            type: 'user',
            message: { role: 'user', content: [{ type: 'text', text: 'hello' }] },
            parent_tool_use_id: null,
            session_id: ''
        });
    });

    test('the prefix goes in front of the text, inside the same block', () => {
        const frame = buildUserMessage({ text: 'plan it', prefix: 'ultrathink\n\n' });
        expect((frame.message as { content: Array<{ text: string }> }).content[0]!.text).toBe('ultrathink\n\nplan it');
    });

    test('attachments are named by path under the text, since both CLIs read a file themselves', () => {
        const frame = buildUserMessage({ text: 'what is this', attachments: [png] });

        expect((frame.message as { content: unknown[] }).content).toEqual([
            { type: 'text', text: 'what is this\n\nAttached files:\n- /home/x/.ruimte/attachments/chat-1/a1.png (shot.png)' }
        ]);
    });

    test('an attachment without text carries the note alone', () => {
        const frame = buildUserMessage({ text: '  ', attachments: [png] });

        expect((frame.message as { content: Array<{ text: string }> }).content).toEqual([
            { type: 'text', text: 'Attached files:\n- /home/x/.ruimte/attachments/chat-1/a1.png (shot.png)' }
        ] as never);
    });
});

describe('skill dispatch', () => {
    test('a prompt that opens with a skill invokes it with the rest as arguments', () => {
        const frame = buildUserMessage({ text: '$unslop the notes', skills: ['unslop'] });
        expect((frame.message as { content: unknown[] }).content).toEqual([{ type: 'text', text: '/unslop the notes' }]);
    });

    test('a skill inside a sentence keeps the sentence whole and invokes the bare skill last', () => {
        const frame = buildUserMessage({ text: 'look at the notes and $unslop them', skills: ['unslop'] });

        expect((frame.message as { content: unknown[] }).content).toEqual([
            { type: 'text', text: 'look at the notes and /unslop them' },
            { type: 'text', text: '/unslop' }
        ]);
    });

    test('a message that is only the skill carries one block', () => {
        const frame = buildUserMessage({ text: '$unslop', skills: ['unslop'] });
        expect((frame.message as { content: unknown[] }).content).toEqual([{ type: 'text', text: '/unslop' }]);
    });

    test('only the last skill is invoked; every skill becomes a slash name in the leading block', () => {
        const frame = buildUserMessage({ text: 'run $lint first, then $unslop it', skills: ['unslop', 'lint'] });

        expect((frame.message as { content: unknown[] }).content).toEqual([
            { type: 'text', text: 'run /lint first, then /unslop it' },
            { type: 'text', text: '/unslop' }
        ]);
    });

    test('the attachment note stays in the leading block, so the invocation is still last', () => {
        const frame = buildUserMessage({ text: 'see $unslop', skills: ['unslop'], attachments: [png] });
        const blocks = (frame.message as { content: Array<{ text: string }> }).content;
        expect(blocks).toHaveLength(2);
        expect(blocks[0]!.text).toBe('see /unslop\n\nAttached files:\n- /home/x/.ruimte/attachments/chat-1/a1.png (shot.png)');
        expect(blocks[1]!.text).toBe('/unslop');
    });

    test('the prefix stays the first thing the model reads', () => {
        const frame = buildUserMessage({ text: '$unslop it', skills: ['unslop'], prefix: 'ultrathink\n\n' });

        expect((frame.message as { content: unknown[] }).content).toEqual([
            { type: 'text', text: 'ultrathink' },
            { type: 'text', text: '/unslop it' }
        ]);
    });

    test('a dollar word that is not a known skill stays text', () => {
        const frame = buildUserMessage({ text: 'it costs $20 and $unknown', skills: ['unslop'] });
        expect((frame.message as { content: unknown[] }).content).toEqual([{ type: 'text', text: 'it costs $20 and $unknown' }]);
    });
});

describe('splitSkillPrompt', () => {
    test('a name that prefixes another is not mistaken for it', () => {
        expect(splitSkillPrompt('use $release-notes now', ['release', 'release-notes'])).toEqual({
            lead: 'use /release-notes now',
            invocation: '/release-notes'
        });
    });

    test('text without a skill token is left alone', () => {
        expect(splitSkillPrompt('nothing here', ['unslop'])).toEqual({ lead: 'nothing here', invocation: null });
    });
});

describe('a skill reference inside a longer prompt', () => {
    test('a `$name` that continues a word is text, so a shell variable survives as written', () => {
        const text = 'Use $review; preserve the shell variable `prefix$review` exactly.';

        expect(splitSkillPrompt(text, ['review'])).toEqual({
            lead: 'Use /review; preserve the shell variable `prefix$review` exactly.',
            invocation: '/review'
        });
        expect(splitSkillPrompt('keep prefix$review and $reviewer', ['review'])).toEqual({ lead: 'keep prefix$review and $reviewer', invocation: null });
    });

    test('a skill at the start, after a newline and before a comma is its own token', () => {
        expect(splitSkillPrompt('$review, then stop', ['review'])).toEqual({ lead: '', invocation: '/review , then stop' });
        expect(splitSkillPrompt('first line\n$review\nlast', ['review'])).toEqual({ lead: 'first line\n/review\nlast', invocation: '/review' });
        expect(splitSkillPrompt('run $lint, then $review.', ['lint', 'review'])).toEqual({ lead: 'run /lint, then /review.', invocation: '/review' });
    });

    test('a skill in brackets or quotes is its own token', () => {
        expect(splitSkillPrompt('use ($review) or "$lint"', ['review', 'lint'])).toEqual({ lead: 'use (/review) or "/lint"', invocation: '/lint' });
    });

    test('a skill inside inline code or a fenced block is text, and never the invocation', () => {
        expect(splitSkillPrompt('Echo `$review` and use $lint', ['review', 'lint'])).toEqual({ lead: 'Echo `$review` and use /lint', invocation: '/lint' });
        expect(splitSkillPrompt('Use $lint.\n\n```sh\necho $review\n```\nDone', ['review', 'lint'])).toEqual({
            lead: 'Use /lint.\n\n```sh\necho $review\n```\nDone',
            invocation: '/lint'
        });
        expect(splitSkillPrompt('Run `echo $review` please', ['review'])).toEqual({ lead: 'Run `echo $review` please', invocation: null });
    });

    test('an unclosed fence runs to the end of the text', () => {
        expect(splitSkillPrompt('Use $lint\n```\n$review', ['review', 'lint'])).toEqual({ lead: 'Use /lint\n```\n$review', invocation: '/lint' });
    });
});

describe('code in a prompt follows CommonMark', () => {
    const skills = ['lint', 'review', 'also'];

    test('a tilde fence is code', () => {
        expect(splitSkillPrompt('Use $lint.\n~~~sh\necho $review\n~~~\nDone', skills)).toEqual({
            lead: 'Use /lint.\n~~~sh\necho $review\n~~~\nDone',
            invocation: '/lint'
        });
    });

    test('a closing fence at least as long as the opening one closes it, a shorter one does not', () => {
        expect(splitSkillPrompt('Use $lint\n````\n```\n$review\n````\nDone', skills)).toEqual({
            lead: 'Use /lint\n````\n```\n$review\n````\nDone',
            invocation: '/lint'
        });
        expect(splitSkillPrompt('Use $lint\n```\n$review\n`````\nthen $also', skills)).toEqual({
            lead: 'Use /lint\n```\n$review\n`````\nthen /also',
            invocation: '/also'
        });
    });

    test('a fence may be indented up to three spaces, closing fence too', () => {
        for (const indent of [' ', '  ', '   ']) {
            expect(splitSkillPrompt(`Use $lint\n${indent}~~~\n$review\n${indent}~~~\nDone`, skills)).toEqual({
                lead: `Use /lint\n${indent}~~~\n$review\n${indent}~~~\nDone`,
                invocation: '/lint'
            });
        }

        expect(splitSkillPrompt('Use $lint\n```\n$review\n   ```\nthen $also', skills).invocation).toBe('/also');
    });

    test('four spaces make a fence line text, and it neither opens nor closes a fence', () => {
        expect(splitSkillPrompt('Use $lint\n    ```\n$review', skills)).toEqual({
            lead: 'Use /lint\n    ```\n/review',
            invocation: '/review'
        });
        expect(splitSkillPrompt('Use $lint\n```\n$review\n    ```\n$also', skills).invocation).toBe('/lint');
    });

    test('a fence closed by the other character stays open', () => {
        expect(splitSkillPrompt('Use $lint\n~~~\n$review\n```\n$also', skills)).toEqual({
            lead: 'Use /lint\n~~~\n$review\n```\n$also',
            invocation: '/lint'
        });
        expect(splitSkillPrompt('Use $lint\n```\n$review\n~~~\n$also', skills).invocation).toBe('/lint');
    });

    test('anything after a closing fence but spaces keeps it open', () => {
        expect(splitSkillPrompt('Use $lint\n```\n$review\n``` x\n$also', skills).invocation).toBe('/lint');
        expect(splitSkillPrompt('Use $lint\n```\n$review\n```  \nthen $also', skills).invocation).toBe('/also');
    });

    test('an unclosed tilde fence runs to the end of the text', () => {
        expect(splitSkillPrompt('Use $lint\n~~~\n$review', skills)).toEqual({ lead: 'Use /lint\n~~~\n$review', invocation: '/lint' });
    });

    test('a backtick fence whose info string holds a backtick is no fence', () => {
        expect(splitSkillPrompt('Use $lint\n```a`b\n$review', skills)).toEqual({ lead: 'Use /lint\n```a`b\n/review', invocation: '/review' });
        expect(splitSkillPrompt('Use $lint\n~~~a`b\n$review\n~~~\nDone', skills).invocation).toBe('/lint');
    });

    test('an indented code block after a blank line or at the start is code', () => {
        expect(splitSkillPrompt('Use $lint\n\n    echo $review\n\nDone', skills)).toEqual({
            lead: 'Use /lint\n\n    echo $review\n\nDone',
            invocation: '/lint'
        });
        expect(splitSkillPrompt('Use $lint\n\n\techo $review\n\tmore $also', skills).invocation).toBe('/lint');
        expect(splitSkillPrompt('    echo $review\n\nUse $lint', skills)).toEqual({
            lead: '    echo $review\n\nUse /lint',
            invocation: '/lint'
        });
    });

    test('an indented line that continues a paragraph is text', () => {
        expect(splitSkillPrompt('Use $lint\n    then $review', skills)).toEqual({
            lead: 'Use /lint\n    then /review',
            invocation: '/review'
        });
    });

    test('text after a closed fence is read as text again', () => {
        expect(splitSkillPrompt('Use $lint\n~~~\n$review\n~~~\nthen $also', skills)).toEqual({
            lead: 'Use /lint\n~~~\n$review\n~~~\nthen /also',
            invocation: '/also'
        });
    });

    test('the invocation is the last token outside code', () => {
        const text = 'Run $lint, then $review.\n~~~\n$also\n~~~\n\n    $also';

        expect(lastSkillToken(text, skills)).toEqual({ index: text.indexOf('$review'), name: 'review' });
        expect(splitSkillPrompt(text, skills).invocation).toBe('/review');
    });

    test('an inline span closed by the same number of backticks is code', () => {
        expect(splitSkillPrompt('Use $lint and ``echo `$review` ``', skills)).toEqual({ lead: 'Use /lint and ``echo `$review` ``', invocation: '/lint' });
    });
});
