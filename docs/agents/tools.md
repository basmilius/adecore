# Tools

A host can give its agents tools to call back into it, for example to open another chat, hand over a task or write in a document. The package declares tools, checks their input and writes the schema an MCP client lists. It has no server and no transport. Your app decides how a call reaches it, checks who is calling, and hands each tool only what it may touch.

```ts
import { defineTool, defineToolkit, ToolRefusal, toolInputSchema } from '@adecore/agents/context';
```

## A tool

A note tool over a write function of your app's own, with a dry run that checks everything and writes nothing:

```ts
import { z } from 'zod';
import { defineTool, defineToolkit, requiredField, ToolRefusal } from '@adecore/agents/context';

interface Call {
    expectedRevision?: number;
    authorized: boolean;
    write(text: string, expectedRevision?: number): Promise<void>;
}

const noteWrite = defineTool('note', {
    name: 'note_write',
    description: 'Writes a note to the active document.',
    input: z.object({
        text: requiredField('note_write needs text').describe('The note text'),
        revision: z.number().int().optional(),
        dry_run: z.boolean().optional()
    }),
    async run(input, call: Call) {
        if (!call.authorized) {
            throw new ToolRefusal('not-permitted', 'This caller may not write this document.');
        }

        if (input.dry_run !== true) {
            await call.write(input.text, input.revision);
        }

        return [input.dry_run === true ? 'preview\tvalidated' : 'note\twritten'];
    }
});

export const noteTools = defineToolkit('note', [noteWrite]);
```

`defineTool` takes a `ToolSpec` and returns a `Tool`. A `Toolkit` holds the tools of one area, such as everything about notes. A tool belongs to one toolkit, named as the first argument of `defineTool`. `defineToolkit` throws when a tool names another toolkit or two tools share a name. Those are mistakes in your code, so they throw a plain `Error`. A tool name is lower snake case, and `defineTool` also throws for an input `toolInputSchema` cannot describe.

`annotations`, the `ToolAnnotations`, tell a client what to expect before it runs a tool: `readOnly` for one that changes nothing, `destructive` for one that removes or overwrites what it cannot give back.

Your `write` must check the revision in the same step as the write. `REVISION_FIELD` is the name of the field a write takes its revision in. `DRY_RUN_PREVIEW` is a sentence that tells a model a dry run is never needed for safety.

## Input

`parseToolInput(tool, input)` checks the input against the tool's schema and returns it parsed. Then `tool.run(input, call)` runs the tool. The check treats a field set to `null` as left out, since models send `null` for fields they skip.

Input that is no object, a field the tool does not have (also when it is `null`), or a value the schema refuses all throw a `bad-arguments` refusal. Its one line holds `fields` and the field names, tab-separated, so a model sees what the tool takes. A schema message names the field it is about.

`requiredField(message)` is a string field that may not be missing or empty. `lengthOf` measures input for a size message. `orNote(lines, note)` answers a note for an empty list.

## Schemas

`toolInputSchema(tool.input)` is the input schema an MCP client lists, a `ToolInputSchema`. It keeps `type`, `description`, `enum`, `required`, `items` and the `properties` of an object, at every depth. An `enum` holds strings, numbers or booleans, so `z.literal([1, 2])` and `z.literal(true)` keep their choices. A record is an `object` without `properties`. It leaves out bounds, `additionalProperties`, null branches and every union branch but the first. A field of no one type, such as `z.unknown()`, `z.date()` or a literal of a string and a number, throws instead of being listed as text. A field with a default or `.optional()` is not required, and a transform shows the type it starts from. The description comes from `.describe()` or `.meta()`.

The bounds still hold, since `parseToolInput` checks the input against the full schema. A model learns them from a refusal instead of from every tool list.

```ts
const tools = noteTools.tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: toolInputSchema(tool.input),
    annotations: { readOnlyHint: tool.annotations.readOnly, destructiveHint: tool.annotations.destructive }
}));
```

## Refusals

`ToolRefusal(code, message, lines?)` is a refusal with advice. It is a `CodedError`, so a host that catches those catches a refusal too.

`refusalBody` writes `refused`, the code and the message as one tab-separated line, then one advice row per line. `refusalRows` leaves out `refused`. A `ParsedRefusal` holds the `code`, the `message` and the advice `lines` of one. `field(value)` makes a value safe for one field, so a tab in a title cannot break a row. None of them shape what a client receives; the host does.

## Chat transcripts

`renderTranscript(items)` from `@adecore/agents/context` renders chat items as a conversation for another agent. Assistant UI blocks use their stored text fallback. A subagent gets one summary line in the parent conversation, without its own activity. Tool calls show up to 300 characters of input and 2000 characters of output, with workflow phases when present. Questions and approvals keep their request ids and current state, and pending questions include their answer fields and choices.

The host decides who may read a thread, which items go in, and any final line limit.
