import { afterEach, describe, expect, test } from 'bun:test';
import { DocumentModel } from '@adecore/editor-core';
import { BUDGETS, DOCUMENTS, measure, release, type Budget } from './view.keystroke.fixture.test.ts';

if (process.env.ADECORE_TEST_KEYSTROKE_ISOLATED !== '1') {
    // Other suites can leave editor timers alive; work budgets need a process with no unrelated editors.
    test('checks keystroke work budgets in an isolated process', async () => {
        const child = Bun.spawn([process.execPath, 'test', import.meta.path], {
            env: { ...process.env, ADECORE_TEST_KEYSTROKE_ISOLATED: '1' },
            stdin: 'ignore',
            stdout: 'pipe',
            stderr: 'pipe'
        });

        const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);

        if (code !== 0) {
            throw new Error(`Keystroke work budgets failed:\n${stderr}\n${stdout}`);
        }
    }, 120_000);
} else {
    afterEach(release);

    test('counts only the measured document while another large document is read in the background', async () => {
        const other = new DocumentModel(DOCUMENTS.code);
        const timer = setInterval(() => other.getText(), 1);

        try {
            const { work } = await measure('code', false);
            expect(Math.max(...work.map((entry) => entry.getText))).toBe(0);
        } finally {
            clearInterval(timer);
        }
    }, 15_000);

    describe('a keystroke in a document of 100,000 lines', () => {
        // This gate bounds work, not wall time; fixture setup shares CI CPUs with the other test worker.
        for (const name of ['code', 'flat'] as const) {
            for (const wrap of [false, true]) {
                test(`stays within its budget in the ${name} document${wrap ? ', wrapped' : ''}`, async () => {
                    const { mounted, work, medianMs } = await measure(name, wrap);
                    const budget = BUDGETS[name];

                    const most = (key: keyof (typeof work)[number]): number => Math.max(...work.map((entry) => entry[key]));

                    // `ADECORE_KEYSTROKE_REPORT=1` prints what each run measured, to set the budgets again.
                    if (process.env.ADECORE_KEYSTROKE_REPORT) {
                        console.log(
                            JSON.stringify({
                                name,
                                wrap,
                                ...Object.fromEntries(Object.keys(budget).map((key) => [key, most(key as keyof Budget)])),
                                medianMs
                            })
                        );
                    }

                    expect(mounted.editor.getCaret().line).toBe(50_004);
                    // A renamed method would leave its spy counting nothing and the gate passing.
                    expect(Math.min(most('laidOut'), most('lexedLines'), most('getLine'), most('elementsCreated'))).toBeGreaterThan(0);
                    expect(most('getText')).toBe(0);
                    expect(most('laidOut')).toBeLessThanOrEqual(budget.laidOut);
                    expect(most('lexedLines')).toBeLessThanOrEqual(budget.lexedLines);
                    expect(most('getLine')).toBeLessThanOrEqual(budget.getLine);
                    expect(most('charactersRead')).toBeLessThanOrEqual(budget.charactersRead);
                    expect(most('elementsCreated')).toBeLessThanOrEqual(budget.elementsCreated);
                }, 15_000);
            }
        }
    });
}
