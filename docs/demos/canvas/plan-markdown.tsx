import { useState } from 'react';
import { createPlan, parsePlanMarkdown, renderPlanText } from '@adecore/plan';
import { TextArea } from '@adecore/ui';

const MARKDOWN = `# Ship the release

Everything that has to happen before a version goes out.

## Prepare

- [x] Write the changelog
- [ ] Run the checks
    - [x] Typecheck
    - [~] Tests
        > Two snapshots to update

## Release

> **Heads-up** A published version cannot be taken back.

- [ ] Approve the release
- [ ] Publish to npm
`;

function readPlan(markdown: string): string {
    const parsed = parsePlanMarkdown(markdown);
    if (!parsed.ok) {
        return `${parsed.code}: ${parsed.message}`;
    }
    let count = 0;
    const created = createPlan(parsed.draft, { id: 'release', now: '2026-10-05T09:00:00.000Z', mintId: () => `item-${++count}` });
    return created.ok ? renderPlanText(created.plan) : `${created.code}: ${created.message}`;
}

export default function PlanMarkdownDemo() {
    const [markdown, setMarkdown] = useState(MARKDOWN);

    return (
        <div className="grid w-full gap-4 md:grid-cols-2">
            <TextArea mono rows={18} value={markdown} onChange={(event) => setMarkdown(event.target.value)} aria-label="Plan as Markdown" />
            <pre className="overflow-x-auto rounded-md bg-surface-sunken p-3 font-mono text-code whitespace-pre-wrap text-text-muted">{readPlan(markdown)}</pre>
        </div>
    );
}
