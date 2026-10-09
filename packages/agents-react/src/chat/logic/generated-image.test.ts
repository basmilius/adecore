import { describe, expect, test } from 'bun:test';
import { CHAT_ATTACHMENT_MAX_BYTES, type ChatAttachment, type ChatToolItem } from '@adecore/agent-contracts';
import { attachmentAspect, generatedImageView, isImageGeneration } from './generated-image';

const ATTACHMENT: ChatAttachment = {
    id: 'att-1',
    name: 'watercolor-rabbit.png',
    mime: 'image/png',
    size: 1_250_000,
    path: '/home/attachments/att-1.png',
    width: 1024,
    height: 768
};

function tool(patch: Partial<ChatToolItem> = {}): ChatToolItem {
    return {
        id: 'g1',
        kind: 'tool',
        createdAt: 1000,
        turnId: 't1',
        toolUseId: 'g1',
        name: 'ImageGeneration',
        input: { attachment: ATTACHMENT, revisedPrompt: '  A watercolor rabbit  ', transparentBackground: true },
        output: null,
        state: 'done',
        parentToolUseId: null,
        ...patch
    };
}

describe('generatedImageView', () => {
    test('a running call is generating, whatever its input says', () => {
        expect(generatedImageView(tool({ state: 'running', input: {} }))).toEqual({ state: 'generating' });
    });

    test('a finished call shows its attachment, trimmed prompt and transparency', () => {
        expect(generatedImageView(tool())).toEqual({ state: 'ready', attachment: ATTACHMENT, prompt: 'A watercolor rabbit', transparent: true });
        expect(generatedImageView(tool({ input: { attachment: ATTACHMENT, revisedPrompt: ' ' } }))).toEqual({
            state: 'ready',
            attachment: ATTACHMENT,
            prompt: null,
            transparent: false
        });
    });

    test('a provider failure keeps its own words', () => {
        expect(generatedImageView(tool({ state: 'error', input: {}, output: 'content_policy: refused\n' }))).toEqual({
            state: 'failed',
            failure: { kind: 'provider', message: 'content_policy: refused' }
        });
        expect(generatedImageView(tool({ state: 'error', output: null }))).toEqual({ state: 'failed', failure: { kind: 'provider', message: null } });
    });

    test('a call without an attachment came back empty unless the provider said why', () => {
        expect(generatedImageView(tool({ input: {} }))).toEqual({ state: 'failed', failure: { kind: 'empty' } });
        expect(generatedImageView(tool({ input: 'garbage', output: 'no image' }))).toEqual({
            state: 'failed',
            failure: { kind: 'provider', message: 'no image' }
        });
    });

    test('checks what came back before it draws it', () => {
        const withAttachment = (patch: Partial<ChatAttachment>) => tool({ input: { attachment: { ...ATTACHMENT, ...patch } } });
        expect(generatedImageView(withAttachment({ size: 0 }))).toEqual({ state: 'failed', failure: { kind: 'empty' } });
        expect(generatedImageView(withAttachment({ mime: 'text/plain' }))).toEqual({ state: 'failed', failure: { kind: 'not-image' } });
        expect(generatedImageView(withAttachment({ size: CHAT_ATTACHMENT_MAX_BYTES + 1 }))).toEqual({
            state: 'failed',
            failure: { kind: 'too-large', limit: CHAT_ATTACHMENT_MAX_BYTES }
        });
    });
});

describe('helpers', () => {
    test('only the ImageGeneration tool is an image generation', () => {
        expect(isImageGeneration(tool())).toBe(true);
        expect(isImageGeneration(tool({ name: 'Read' }))).toBe(false);
    });

    test('the aspect needs both dimensions', () => {
        expect(attachmentAspect(ATTACHMENT)).toBe(1024 / 768);
        expect(attachmentAspect({ ...ATTACHMENT, height: undefined })).toBeUndefined();
    });
});
