# Attachments and mentions

Uploads are `{ name, mime, data }`, where `data` is base64. Stored message attachments instead carry metadata and an attachment ID; the host serves their bytes. Keep attachment file access behind the host's permission checks.

## Read and check uploads

The shared contract currently allows eight attachments, at most 10 MiB per file and 10 MiB total decoded bytes. Zero-byte files are rejected. Use contract constants rather than duplicating limits, because the backend checks them too. Base64 increases transfer size; the limits use decoded bytes.

```ts
import type { ChatAttachmentUpload } from '@adecore/agent-contracts';
import { checkAttachmentLimits, readAttachments, uploadBytes } from '@adecore/agents-react/chat/attachments';

export async function collectUploads(files: File[], current: ChatAttachmentUpload[]) {
    const checked = checkAttachmentLimits(
        current.length,
        files.map((file) => ({ file, name: file.name, mime: file.type, bytes: file.size })),
        current.reduce((total, upload) => total + uploadBytes(upload), 0)
    );
    const uploads = await readAttachments(checked.accepted.map((entry) => entry.file));
    return { uploads, rejected: checked.rejected };
}
```

`readAttachments` uses browser `FileReader`, names unnamed pasted files, and resolves image MIME types through the contracts. A failed file read rejects the batch. `readStoredAttachments(read, stored)` downloads blobs and turns them back into uploads for queue editing. These helpers have no abort argument; the host controls the download lifetime.

Pasted plain text of at least 32 KiB becomes a `paste-N.txt` attachment. Mod+Shift+V explicitly keeps a large paste inline. File paste and file drop become uploads; mention drops become path tokens. `UploadThumb` uses a generated thumbnail, while `uploadPreviewUrl` exposes a data URL for an upload the composer still holds.

## Serve stored resources

This complete adapter receives an authorized host download function. The hook releases its object URL on key changes/unmount and ignores late results; the underlying read function owns cancellation or timeouts.

```tsx
import { useEffect, useState } from 'react';
import { setChatHost, type ResourceUrl } from '@adecore/agents-react/host';

type ReadAttachment = (scopeId: string, chatId: string, attachmentId: string) => Promise<Blob>;
const emptyResource: ResourceUrl = { url: null, failure: null };

export function installAttachmentAccess(read: ReadAttachment): void {
    function useUrl(scopeId: string, chatId: string, attachmentId: string): ResourceUrl {
        const key = JSON.stringify([scopeId, chatId, attachmentId]);
        const [result, setResult] = useState<{ key: string; resource: ResourceUrl } | null>(null);
        useEffect(() => {
            let active = true;
            let url: string | null = null;
            void read(scopeId, chatId, attachmentId)
                .then((blob) => {
                    if (active) {
                        url = URL.createObjectURL(blob);
                        setResult({ key, resource: { url, failure: null } });
                    }
                })
                .catch((cause: unknown) => {
                    if (active) {
                        setResult({ key, resource: { url: null, failure: cause instanceof Error ? cause.message : String(cause) } });
                    }
                });
            return () => {
                active = false;
                if (url !== null) {
                    URL.revokeObjectURL(url);
                }
            };
        }, [key, scopeId, chatId, attachmentId]);
        return result?.key === key ? result.resource : emptyResource;
    }
    setChatHost({ attachments: { read, useUrl } });
}
```

Supply this adapter before rendering. `ResourceUrl.failure` lets image UI explain a refused/unavailable resource; null URL and null failure mean no bytes are ready. `ChatHost.ReadImage` is a separate optional component for tool-read image paths. It must apply the same path policy.

## File, skill, and chat pickers

`ChatHost.searchFiles(scopeId, cwd, query, limit)` returns relative paths. The composer debounces nonempty queries for 80 ms and offers up to eight files. A bare `@` searches immediately. Stale responses cannot be selected as the new query's answer; request failures leave the picker without a new result. Returning a path is not permission to read it on the backend.

`useReferableChats()` supplies chat IDs and titles. Chat suggestions sit above file results and appear as separate chips, with up to four chat suggestions. `$` suggestions come from `ChatClient.listSkills`; names must start with a letter, so `$20` stays text. A sigil must start a word, which keeps an email address from opening a picker. Selected file and skill tokens are highlighted only while still present in the text.

## Migrate drag producers and receivers together

`MENTION_DRAG_TYPE` is `application/x-adecore-mention`. `MENTION_DRAG_TYPES` also includes `LEGACY_MENTION_DRAG_TYPE`. `carriesMentions(types)` recognizes either format, and `droppedMentions(data)` prefers the new nonempty payload before the legacy one.

```ts
import { carriesMentions, droppedMentions, writeMentionDrag } from '@adecore/agents-react/chat/mentions';

export function startPathDrag(event: DragEvent, paths: readonly string[]): void {
    if (event.dataTransfer) {
        writeMentionDrag(event.dataTransfer, paths);
    }
}

export function readPathDrop(event: DragEvent): string[] {
    const data = event.dataTransfer;
    if (!data || !carriesMentions(data.types)) {
        return [];
    }
    event.preventDefault();
    return droppedMentions(data);
}

export function acceptPathDrag(event: DragEvent): void {
    if (event.dataTransfer && carriesMentions(event.dataTransfer.types)) {
        event.preventDefault();
    }
}
```

Connect these functions to a host file list and drop target; the target must accept `dragover` before the browser dispatches a useful drop. Producers write both formats by default. Once every receiver accepts the new format, call `writeMentionDrag(data, paths, false)` to stop writing the legacy value. New receivers still read legacy values.

The payload remains a space-separated path list with no quoting or escaping. Paths containing whitespace cannot round-trip as one path through this format. Changing the MIME label alone does not fix that limitation or authorize a serialization change.
