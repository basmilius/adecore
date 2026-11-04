import { describe, expect, test } from 'bun:test';
import { readChatCompletionsStream, type ChatCompletionsTokens } from './chat-completions-stream.ts';

function frame(chunk: unknown): string {
    return `data: ${JSON.stringify(chunk)}\n\n`;
}

/* A body that arrives in the pieces given, so a frame or a line ending can fall across two of them. */
function streamBody(...pieces: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();

    return new ReadableStream({
        start(controller) {
            for (const piece of pieces) {
                controller.enqueue(encoder.encode(piece));
            }

            controller.close();
        }
    });
}

async function read(stream: ReadableStream<Uint8Array>) {
    const text: string[] = [];
    const thinking: string[] = [];
    const usage: ChatCompletionsTokens[] = [];

    const answer = await readChatCompletionsStream(stream, 'Api', {
        onText: (piece) => text.push(piece),
        onThinking: (piece) => thinking.push(piece),
        onUsage: (counts) => usage.push(counts)
    });

    return { answer, text, thinking, usage };
}

describe('readChatCompletionsStream', () => {
    test('streams text and thinking as they come and keeps the whole answer', async () => {
        const { answer, text, thinking, usage } = await read(
            streamBody(
                frame({ choices: [{ delta: { reasoning: 'Look ' } }] }),
                frame({ choices: [{ delta: { reasoning_content: 'first.' } }] }),
                frame({ choices: [{ delta: { content: 'Hello ' } }] }),
                frame({ choices: [{ delta: { content: 'there.' }, finish_reason: 'stop' }] }),
                frame({
                    choices: [],
                    usage: {
                        prompt_tokens: 42,
                        completion_tokens: 7,
                        prompt_tokens_details: { cached_tokens: 10 },
                        completion_tokens_details: { reasoning_tokens: 3 }
                    }
                }),
                'data: [DONE]\n\n'
            )
        );

        expect(text).toEqual(['Hello ', 'there.']);
        expect(thinking).toEqual(['Look ', 'first.']);
        expect(usage).toEqual([{ prompt: 42, cached: 10, completion: 7, reasoning: 3 }]);
        expect(answer).toEqual({ role: 'assistant', content: 'Hello there.', reasoning_content: 'Look first.' });
    });

    test('counts a request that reports only its prompt, with the rest as zero', async () => {
        const { usage } = await read(
            streamBody(frame({ choices: [{ delta: { content: 'Hi' }, finish_reason: 'stop' }], usage: { prompt_tokens: 5 } }), 'data: [DONE]\n\n')
        );

        expect(usage).toEqual([{ prompt: 5, cached: 0, completion: 0, reasoning: 0 }]);
    });

    test('puts tool calls together from their pieces, across chunks and CRLF line endings', async () => {
        const first = frame({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call-1', function: { name: 'read_', arguments: '{"path":' } }] } }] });

        const second = frame({
            choices: [{ delta: { tool_calls: [{ index: 0, function: { name: 'file', arguments: '"a.txt","offset":0}' } }] }, finish_reason: 'tool_calls' }]
        });

        const crlf = `${first}${second}data: [DONE]\n\n`.replace(/\n/g, '\r\n');
        const split = crlf.indexOf('\r\n\r\n') + 1;
        const { answer } = await read(streamBody(crlf.slice(0, split), crlf.slice(split)));

        expect(answer.tool_calls).toEqual([{ id: 'call-1', type: 'function', function: { name: 'read_file', arguments: '{"path":"a.txt","offset":0}' } }]);
    });

    test('a connection that ends early is an error and not a short answer', async () => {
        await expect(read(streamBody(frame({ choices: [{ delta: { content: 'Half' } }] })))).rejects.toThrow(
            'Api connection ended before the response completed.'
        );
    });

    test('an answer cut off by the context is an error', async () => {
        await expect(read(streamBody(frame({ choices: [{ delta: { content: 'Long' }, finish_reason: 'length' }] }), 'data: [DONE]\n\n'))).rejects.toThrow(
            'Api stopped with length.'
        );
    });

    test('an error in the stream says nothing of what came with it', async () => {
        await expect(read(streamBody(frame({ error: { message: 'key api-secret is invalid' } })))).rejects.toThrow('Api reported a streaming error.');
    });

    test('a tool call without an id is refused', async () => {
        const call = frame({
            choices: [{ delta: { tool_calls: [{ index: 0, function: { name: 'list_files', arguments: '{}' } }] }, finish_reason: 'tool_calls' }]
        });

        await expect(read(streamBody(call, 'data: [DONE]\n\n'))).rejects.toThrow('Api returned incomplete tool calls.');
    });
});
