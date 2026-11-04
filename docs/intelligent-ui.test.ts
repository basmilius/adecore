import { Glob } from 'bun';
import { afterEach, beforeEach, describe, expect, setSystemTime, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
// The docs workspace does not depend on the package, so the test reads its source and its zod directly.
import { z } from '../packages/intelligent-ui/node_modules/zod';
import { compileUi, evaluateUiBlock, UiState, type UiNode } from '../packages/intelligent-ui/src/index.ts';

// A stopped clock, so a slow runner cannot spend the time budget of a UI block before it is built.
beforeEach(() => setSystemTime(Date.now()));
afterEach(() => setSystemTime());

const HERE = fileURLToPath(new URL('.', import.meta.url));

// The sources the examples on the pages read, with the arguments a host would accept for them.
const QUERY_SCHEMAS = {
    'ci.runs': z.strictObject({ branch: z.string(), limit: z.number().int().positive().optional() }),
    'tasks.open': z.strictObject({ project: z.string() })
};

const PAGES = [
    ...[...new Glob('intelligent-ui/**/*.md').scanSync(HERE)].map((path) => path.replaceAll('\\', '/')),
    'agents-react/chat/intelligent-ui.md'
].sort();
/* Every ```ui fence on those pages, as written. */
const examples = PAGES.flatMap((path) =>
    [...readFileSync(join(HERE, path), 'utf8').matchAll(/^```ui\n([\s\S]*?)^```$/gm)].map((match, index) => ({
        name: `${path} #${index + 1}`,
        source: match[1]!
    }))
);

function erroredNodes(nodes: readonly { type: string; error?: string; children: readonly unknown[] }[]): string[] {
    return nodes.flatMap((node) => [...(node.error ? [`${node.type}: ${node.error}`] : []), ...erroredNodes(node.children as UiNode[])]);
}

describe('the intelligent UI examples', () => {
    test('are found on the pages', () => {
        expect(examples.length).toBeGreaterThan(20);
    });

    test.each(examples)('$name compiles without a diagnosis', ({ source }) => {
        const blocks = compileUi(`\`\`\`ui\n${source}\`\`\`\n`, { id: 'docs', final: true, querySchemas: QUERY_SCHEMAS, now: () => 0 });
        expect(blocks).toHaveLength(1);
        const [block] = blocks;
        expect(block!.diagnostics).toEqual([]);
        expect(erroredNodes(block!.nodes)).toEqual([]);
        // Without a reading a query is no value yet, so only a block without one evaluates as written.
        if (Object.keys(block!.queries).length === 0) {
            const evaluation = evaluateUiBlock(block!, new UiState(block!), { milliseconds: 5000 });
            expect(evaluation.diagnostics).toEqual([]);
        }
    });
});
