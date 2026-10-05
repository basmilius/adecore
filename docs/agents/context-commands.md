# Context commands

`context/verb`, `context/argv`, and `context/refusal` help implement a host-owned command interface. They create no executable, server, socket, hook, or permissions endpoint. The consumer authenticates the caller and supplies the operations a command may invoke.

## A complete command adapter

This example defines a note command over an injected host write function. Its dry run validates the same arguments and permissions but omits the write.

```ts
import { z } from 'zod';
import { createVerbRegistry, requiredField, VerbRefusal, type VerbCallBase } from '@adecore/agents/context/verb';
import { refusalBody } from '@adecore/agents/context/refusal';

interface Call extends VerbCallBase {
    authorized: boolean;
    write(text: string, expectedRevision?: number): Promise<void>;
}

export const registry = createVerbRegistry<Call>({ cli: 'app-context' });
export const note = registry.defineVerb({
    name: 'note',
    usage: '--text T',
    summary: 'Writes a note to the active document',
    detail: ['flag\t--text T\trequired\tThe note text'],
    positionals: z.array(z.string()).max(0),
    flags: z.object({ text: requiredField('note needs --text') }),
    dryRun: true,
    revision: true,
    run: async ({ flags, dryRun }, call) => {
        if (!call.authorized) {
            throw new VerbRefusal('not-permitted', 'This caller may not write this document.');
        }
        if (!dryRun) {
            await call.write(flags.text, call.expectedRevision);
        }
        return [dryRun ? 'preview\tvalidated' : 'note\twritten'];
    }
});

export async function runNote(argv: readonly string[], call: Call): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    try {
        return { exitCode: 0, stdout: (await note.run(argv, call)).join('\n'), stderr: '' };
    } catch (error) {
        if (error instanceof VerbRefusal) {
            return { exitCode: 3, stdout: '', stderr: refusalBody(error.code, error.message, error.lines) };
        }
        throw error;
    }
}
```

`write` is the host adapter, not a package method. It must enforce `expectedRevision` atomically with the write if a revision was supplied. The registry only parses and passes the revision number.

## Arguments and help

Flags normally use `--name value` or `--name=value`. A value beginning with `--` needs the equals form. Declared switches take no value; a name declared as both switch and value accepts a value only after `=`. The parser refuses unknown, duplicate, missing-value, and unexpected-value flags. Positionals and flag values then pass through their Zod schemas.

`defineAction(noun, spec)` and `defineNoun` group operations under a noun. `defineHelp({ entries, root, refusal, topics })` renders usage/detail/topic lines from the same definitions used for dispatch. Use `summaryLines` for a compact list. `requiredField` supplies a consistent missing/empty flag message, `lengthOf` supports input-size messages, and `orNote` prints a note when a list is empty.

Only a verb declaring `dryRun: true` accepts `--dry-run`; others refuse it with `no-dry-run` and list permitted verbs. The package does not stop side effects for you: your `run` adapter must take the dry-run branch. A revision-enabled verb accepts `--revision N` and adds it to `call.expectedRevision`. The parser validates a decimal whole-number spelling, but the host should enforce any range/safe-integer requirement its revision store needs.

## Refusal format

A `VerbRefusal` carries `code`, `message`, and advice `lines`. `refusalBody` prints `refused<TAB>code<TAB>message` followed by tab-separated advice rows. `refusalRows` omits the prefix for a host CLI that already adds it. `parseRefusalBody` accepts either format and returns null when the text is not a refusal.

`field(value)` replaces tabs/newlines inside individual fields. Advice rows retain their tabs but drop newlines. Do not interpolate untrusted titles into raw rows without `field`. Exit code 3 in this adapter is a host CLI convention shown in the example; the helper itself writes no stderr and exits no process.
