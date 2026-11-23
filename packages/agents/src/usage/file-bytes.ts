import { open } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { createZstdDecompress } from 'node:zlib';

// How much of a transcript is read at once. Codex writes sessions of more than a gigabyte, which read whole held several times their size.
const READ_CHUNK_BYTES = 1 << 20;

async function* fileChunks(path: string, from: number): AsyncGenerator<Uint8Array> {
    const handle = await open(path, 'r');

    try {
        let position = from;

        for (;;) {
            // A buffer per chunk: a decompressor may still hold the one before.
            const chunk = Buffer.alloc(READ_CHUNK_BYTES);
            const { bytesRead } = await handle.read(chunk, 0, chunk.length, position);

            if (bytesRead === 0) {
                return;
            }

            position += bytesRead;
            yield chunk.subarray(0, bytesRead);
        }
    } finally {
        await handle.close();
    }
}

/* The bytes of a file from `from` on, decompressed for a `.zst` one; a failure on either side ends the iteration with it. */
export function readBytes(path: string, from: number, compressed: boolean): AsyncIterable<Uint8Array> {
    if (!compressed) {
        return fileChunks(path, from);
    }

    const source = Readable.from(fileChunks(path, from));
    const decompressed = createZstdDecompress();
    source.on('error', (error) => decompressed.destroy(error));

    return source.pipe(decompressed);
}
