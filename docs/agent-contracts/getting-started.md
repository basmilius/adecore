# Getting started

Import from the root when you need several contract groups, or choose a [public subpath](./validation-and-compatibility#public-entrypoints). Both forms export the same definitions. Types inferred from schemas describe their parsed output; call a schema when data crosses a boundary.

```ts
import { AGENT_REQUEST_SCHEMAS, ChatAttachmentUploadSchema } from '@adecore/agent-contracts';
import type { ChatSendPayload } from '@adecore/agent-contracts/chat';

const message: ChatSendPayload = {
    chatId: 'chat-1',
    text: 'Read the attached note.',
    attachments: [
        ChatAttachmentUploadSchema.parse({
            name: 'note.txt',
            mime: 'text/plain',
            data: 'SGVsbG8='
        })
    ]
};
const payload = AGENT_REQUEST_SCHEMAS['chat.send'].payload.parse(message);
const result = AGENT_REQUEST_SCHEMAS['chat.send'].result.parse({ queued: false });
```

The attachment `data` is raw base64 without a data URL prefix. The schema checks encoding and size. It does not inspect file contents or upload anything.

## Local and compiled use

The checkout uses Bun workspaces. From the repository root, build the contracts package with:

```sh
bun run --cwd packages/agent-contracts build
bun run --cwd packages/agent-contracts typecheck
bun run --cwd packages/agent-contracts test
```

A workspace or linked development consumer must enable the `source` condition in its bundler and TypeScript configuration. Bun selects it with `bun --conditions=source`; TypeScript accepts `customConditions: ["source"]` with a compatible module resolution mode. This loads the `.ts` export targets directly.

Default imports use `dist`. Build before using them in Node or checking a consumer against compiled declarations. Node needs an ESM consumer and a runtime that supports the package's modern JavaScript features, including `Intl.Segmenter`. Packed consumer validation covers Node 22 and 24. No CSS, theme, or i18n setup is needed for this package.

## Compose a host protocol

`AGENT_REQUEST_SCHEMAS` is an object keyed by request names. Each entry has `payload` and `result` schemas. `AGENT_EVENT_SCHEMAS` maps event names to payload schemas. `AgentRequestType` and `AgentEventType` are their key unions.

```ts
import { z } from 'zod';
import { AGENT_REQUEST_SCHEMAS, AGENT_EVENT_SCHEMAS } from '@adecore/agent-contracts';

const hostRequests = {
    ...AGENT_REQUEST_SCHEMAS,
    'document.read': {
        payload: z.object({ id: z.string().min(1) }),
        result: z.object({ text: z.string() })
    }
};
const hostEvents = {
    ...AGENT_EVENT_SCHEMAS,
    'document.changed': z.object({ id: z.string().min(1) })
};
```

The added document operation is host provided. Its implementation, authorization, and channel registration belong to the consumer. Keeping the existing agent table keys and parsed shapes preserves compatibility during a package rename.
