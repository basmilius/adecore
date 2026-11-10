import { Input } from '@adecore/ui';

const LINE =
    'flex h-9 items-center gap-2 border-b border-border px-3 last:border-b-0 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:-outline-offset-2 has-[input:focus-visible]:outline-accent-on-surface';

export default function InputBare() {
    return (
        <div className="flex w-96 flex-col overflow-hidden rounded-lg border border-border bg-surface">
            <label className={LINE}>
                <span className="w-16 shrink-0 text-xs text-text-muted">To</span>
                <Input variant="bare" placeholder="Name or address" />
            </label>
            <label className={LINE}>
                <span className="w-16 shrink-0 text-xs text-text-muted">Subject</span>
                <Input variant="bare" defaultValue="Q1 roadmap planning" />
            </label>
        </div>
    );
}
