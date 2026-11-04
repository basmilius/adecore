import { z } from 'zod';
import { RecordDirectory } from '../record-directory.ts';

const PendingPromptFieldsSchema = z.object({
    projectId: z.string().min(1),
    nodeId: z.string().min(1),
    prompt: z.string().min(1),
    createdAt: z.number()
});

export type PendingPromptFields = z.infer<typeof PendingPromptFieldsSchema>;

/* What a host keeps beside the prompt, such as instructions for the first turn. */
export type PendingPromptExtra = Record<string, unknown>;

export interface PendingPromptStoreOptions<Extra extends PendingPromptExtra> {
    /* One file per held prompt. */
    dir: string;

    /* The fields a host keeps beside the prompt, stored at the top level of each record. */
    extra?: z.ZodType<Extra>;

    now?: () => number;
}

/* What `take` hands back: the prompt and whatever the host kept beside it. */
export type FirstPrompt<Extra extends PendingPromptExtra> = { prompt: string } & Partial<Extra>;

function definedOnly<Value extends object>(value: Value): Partial<Value> {
    return Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as Partial<Value>;
}

/*
 * The first prompt of a node, held against its id until its chat or session exists. On disk, since
 * the host may stop before the node starts; outside any shared project file, which two windows would
 * deliver twice.
 */
export class PendingPromptStore<Extra extends PendingPromptExtra = Record<never, never>> {
    readonly dir: string;
    private readonly pending: RecordDirectory<PendingPromptFields & Extra>;
    private readonly now: () => number;

    constructor(options: PendingPromptStoreOptions<Extra>) {
        this.dir = options.dir;
        this.now = options.now ?? Date.now;

        const schema = options.extra === undefined ? PendingPromptFieldsSchema : z.intersection(PendingPromptFieldsSchema, options.extra);

        this.pending = new RecordDirectory({ dir: this.dir, schema: schema as z.ZodType<PendingPromptFields & Extra>, idOf: (entry) => entry.nodeId });
    }

    /* Reads what an earlier run of the host was still holding. Call before anything can take one. */
    load(): Promise<void> {
        return this.pending.load();
    }

    async put(projectId: string, nodeId: string, prompt: string, extra?: Partial<Extra>): Promise<void> {
        await this.pending.write({ ...definedOnly(extra ?? {}), projectId, nodeId, prompt, createdAt: this.now() } as PendingPromptFields & Extra);
    }

    /*
     * The prompt held for a node, gone the moment it is asked for. The map is emptied before the first
     * await, so two callers for the same node cannot both get it, and the file is gone before the caller
     * is answered, so a restart in between does not hand it out a second time.
     */
    async take(nodeId: string): Promise<FirstPrompt<Extra> | null> {
        const entry = this.pending.get(nodeId);

        if (!entry) {
            return null;
        }

        await this.pending.remove(nodeId);
        const { projectId: _projectId, nodeId: _nodeId, createdAt: _createdAt, ...kept } = entry;

        return definedOnly(kept) as FirstPrompt<Extra>;
    }

    has(nodeId: string): boolean {
        return this.pending.has(nodeId);
    }

    /* Drops what `drop` picks, such as prompts for nodes deleted before anyone ran them. */
    prune(drop: (entry: PendingPromptFields) => boolean): Promise<void> {
        return this.pending.prune(drop);
    }
}
