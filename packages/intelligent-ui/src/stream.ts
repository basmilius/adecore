import { UiCompiler, type UiBlock, type UiCompilerOptions } from './compiler.ts';

export const UI_STREAM_INTERVAL_MS = 250;

export interface UiStreamClock {
    now(): number;
    setTimeout(run: () => void, ms: number): unknown;
    clearTimeout(handle: unknown): void;
}

export interface UiStreamPreview {
    textLength: number;
    blocks: UiBlock[];
}

export interface UiStreamOptions extends UiCompilerOptions {
    clock: UiStreamClock;
    emit(preview: UiStreamPreview): void;
}

export class UiStream {
    private readonly compiler: UiCompiler;
    private readonly options: UiStreamOptions;
    private pending: { text: string; latestAttachment?: string } | null = null;
    private timer: { handle: unknown } | null = null;
    private lastCompiledAt = -Infinity;
    private closed = false;

    constructor(options: UiStreamOptions) {
        this.options = options;
        this.compiler = new UiCompiler(options);
    }

    update(text: string, latestAttachment?: string): void {
        if (this.closed) {
            return;
        }
        this.pending = { text, latestAttachment };
        if (this.timer !== null) {
            return;
        }
        const delay = Math.max(0, UI_STREAM_INTERVAL_MS - (this.options.clock.now() - this.lastCompiledAt));
        if (delay === 0) {
            this.flush();
        } else {
            this.timer = { handle: this.options.clock.setTimeout(() => this.flush(), delay) };
        }
    }

    finish(text: string, latestAttachment?: string): UiBlock[] {
        this.dispose();
        const blocks = this.compiler.compile(text, { final: true, latestAttachment });
        this.compiler.clear();
        return blocks;
    }

    dispose(): void {
        this.closed = true;
        if (this.timer !== null) {
            this.options.clock.clearTimeout(this.timer.handle);
            this.timer = null;
        }
        this.pending = null;
        this.compiler.clear();
    }

    private flush(): void {
        this.timer = null;
        const pending = this.pending;
        if (pending === null || this.closed) {
            return;
        }
        this.pending = null;
        this.lastCompiledAt = this.options.clock.now();
        const blocks = this.compiler.compile(pending.text, { latestAttachment: pending.latestAttachment });
        this.options.emit({ textLength: pending.text.length, blocks });
    }
}
