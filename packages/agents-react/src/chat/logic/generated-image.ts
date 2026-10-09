import { CHAT_ATTACHMENT_MAX_BYTES, GeneratedImageInputSchema, type ChatAttachment, type ChatToolItem } from '@adecore/agent-contracts';

export const IMAGE_GENERATION_TOOL = 'ImageGeneration';

/* Why a generation shows no image: the provider's own words, or a check of what came back. */
export type GeneratedImageFailure =
    | { kind: 'provider'; message: string | null }
    | { kind: 'empty' }
    | { kind: 'not-image' }
    | { kind: 'too-large'; limit: number };

export type GeneratedImageView =
    | { state: 'generating' }
    | { state: 'failed'; failure: GeneratedImageFailure }
    | { state: 'ready'; attachment: ChatAttachment; prompt: string | null; transparent: boolean };

export function isImageGeneration(tool: ChatToolItem): boolean {
    return tool.name === IMAGE_GENERATION_TOOL;
}

/* What the row of an image generation draws, from the tool call alone. */
export function generatedImageView(tool: ChatToolItem): GeneratedImageView {
    if (tool.state === 'running') {
        return { state: 'generating' };
    }
    const parsed = GeneratedImageInputSchema.safeParse(tool.input);
    const input = parsed.success ? parsed.data : {};
    const output = tool.output?.trim() || null;
    if (tool.state === 'error' || input.attachment === undefined) {
        return { state: 'failed', failure: output === null && tool.state !== 'error' ? { kind: 'empty' } : { kind: 'provider', message: output } };
    }
    const attachment = input.attachment;
    if (attachment.size === 0) {
        return { state: 'failed', failure: { kind: 'empty' } };
    }
    if (!attachment.mime.startsWith('image/')) {
        return { state: 'failed', failure: { kind: 'not-image' } };
    }
    if (attachment.size > CHAT_ATTACHMENT_MAX_BYTES) {
        return { state: 'failed', failure: { kind: 'too-large', limit: CHAT_ATTACHMENT_MAX_BYTES } };
    }
    return { state: 'ready', attachment, prompt: input.revisedPrompt?.trim() || null, transparent: input.transparentBackground === true };
}

/* Width over height, when the attachment carries both. */
export function attachmentAspect(attachment: ChatAttachment): number | undefined {
    return attachment.width !== undefined && attachment.height !== undefined ? attachment.width / attachment.height : undefined;
}
