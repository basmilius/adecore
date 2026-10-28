# Context commands

A host can give its agents a command line to call back into it, for example to open another chat, hand over a task or read a document. The package parses the command and writes its help and refusals. It has no executable, server, socket or hook. Your app decides how a call reaches it, checks who is calling, and hands each verb only what it may touch.

```ts
import { createVerbRegistry, requiredField, VerbRefusal } from '@adecore/agents/context';
```

## A verb

A note verb over a write function of your app's own, with a dry run that checks everything and writes nothing:

```ts
import { z } from 'zod';
import { createVerbRegistry, requiredField, VerbRefusal, type VerbCallBase, refusalBody } from '@adecore/agents/context';

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

Your `write` must check the revision in the same step as the write. The registry only parses the number and passes it as `expectedRevision`.

## Arguments and help

A flag is `--name value` or `--name=value`. A value starting with `--` needs the second form. A switch takes no value. Unknown, repeated and missing flags fail before the verb runs. Then positionals and flags go through their Zod schemas. `requiredField(message)` is a string flag that may not be missing or empty. `lengthOf` measures input for a size message. `orNote(lines, note)` prints a note for an empty list.

`defineNoun` and `defineAction` group verbs under a noun. `defineHelp` writes usage, detail and topics from the dispatch definitions, and `summaryLines` writes the short list.

Only a verb with `dryRun: true` takes `--dry-run`. Others refuse it with `no-dry-run`. Your `run` gets it as `dryRun` and must skip the writes itself. A verb with `revision: true` takes `--revision N`.

## Refusals

`VerbRefusal(code, message, lines?)` is a refusal with advice. `refusalBody` writes `refused`, the code and the message as one tab-separated line, then one advice row per line. `refusalRows` leaves out `refused`, for a command line that prints it itself. `parseRefusalBody` reads either back, or returns `null` for other text. `field(value)` makes a value safe for one field, so a tab in a title cannot break a row. The helpers neither print nor exit. Exit code 3 above is the example's choice.
