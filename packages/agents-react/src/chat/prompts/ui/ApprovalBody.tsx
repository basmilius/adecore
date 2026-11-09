import type { ChatApprovalItem } from '@adecore/agent-contracts';
import { Button, ScrollArea, TextMenu } from '@adecore/ui';
import clsx from 'clsx';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatHost } from '../../../host/host';
import type { PromptDraft } from '../../../host/prompts';
import { approvalChanges, fileChanges } from '../../logic/tools';
import { ApprovalReview } from '../../ui/diff/ApprovalReview';
import { reviewEntries } from '../../ui/diff/review-plan';
import { isPrimaryKey } from '../logic/keys';

/* A command in the sunken box a person reads before allowing it, with the folder it runs in when that is known. */
function CommandBox({ command, cwd }: { command: string; cwd?: string }) {
    return (
        <TextMenu className="rounded-xl bg-surface-sunken p-3">
            {cwd !== undefined && <p className="mb-2 break-all font-mono text-xs text-text-muted select-text">{cwd}</p>}
            <pre className="whitespace-pre-wrap break-words font-mono text-code text-text select-text">{command}</pre>
        </TextMenu>
    );
}

function ApprovalDetails({ item }: { item: ChatApprovalItem }) {
    const host = useChatHost();
    const { t } = useTranslation('agent-prompts');
    const [expanded, setExpanded] = useState(false);
    const patches = approvalChanges(item.input);
    const edits = patches.length ? [] : fileChanges(item.toolName, item.input);
    const entries = reviewEntries(patches, edits);
    const editorPreview = host.code.editor !== undefined;
    const maxHeight = expanded ? 480 : 176;
    const input = typeof item.input === 'object' && item.input !== null ? (item.input as Record<string, unknown>) : {};
    // Some agents describe a command by the command itself, which the box under it already shows.
    const describes = item.description && item.description.trim() !== (typeof input.command === 'string' ? input.command.trim() : null);

    return (
        <>
            {describes && <p className="text-sm text-text-muted">{item.description}</p>}
            {patches.length + edits.length > 1 && (
                <p className="text-xs text-text-muted">{t('approval.allChanges', { count: patches.length + edits.length })}</p>
            )}
            {patches.length + edits.length > 0 ? (
                <div className="overflow-hidden rounded-xl bg-surface-sunken">
                    {editorPreview ? (
                        <div className="overflow-hidden">
                            <ApprovalReview key={item.requestId} entries={entries} maxHeight={maxHeight} />
                        </div>
                    ) : (
                        <ScrollArea axis="both" className={clsx(!expanded && 'max-h-44')}>
                            <ApprovalReview key={item.requestId} entries={entries} maxHeight={maxHeight} />
                        </ScrollArea>
                    )}
                    <div className="flex items-center border-t border-border p-1">
                        <Button size="sm" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
                            {expanded ? t('approval.collapseDiff') : t('approval.viewDiff')}
                        </Button>
                    </div>
                </div>
            ) : typeof input.command === 'string' ? (
                <CommandBox command={input.command} cwd={typeof input.cwd === 'string' ? input.cwd : undefined} />
            ) : (
                <details>
                    <summary className="flex h-7 cursor-pointer items-center text-xs text-text-muted">{t('approval.details')}</summary>
                    <TextMenu>
                        <ScrollArea
                            render={<pre />}
                            className="max-h-64 rounded-xl bg-surface-sunken"
                            viewportClassName="whitespace-pre-wrap break-words p-3 font-mono text-code text-text select-text"
                        >
                            {JSON.stringify(item.input, null, 2)}
                        </ScrollArea>
                    </TextMenu>
                </details>
            )}
        </>
    );
}

/* A chat's permission request: the diff, the command or the raw input, and the reason a Deny may carry. */
export function ApprovalBody({
    item,
    draft,
    onDraft,
    denyReason,
    locked
}: {
    item: ChatApprovalItem;
    draft: PromptDraft;
    onDraft(draft: PromptDraft): void;
    denyReason: boolean;
    locked: boolean;
}) {
    const host = useChatHost();
    const { t } = useTranslation('agent-prompts');
    const AnswerField = host.dictation.Textarea;

    return (
        <>
            <ApprovalDetails item={item} />
            {denyReason && draft.showReason && (
                <AnswerField
                    className="field min-h-16 text-sm"
                    autoFocus
                    aria-label={t('approval.reasonLabel')}
                    placeholder={t('approval.reasonPlaceholder')}
                    disabled={locked}
                    value={draft.reason}
                    onChange={(e) => onDraft({ ...draft, reason: e.target.value })}
                    onKeyDown={(e) => {
                        // Mod+Enter presses Allow everywhere else in the card, which is the opposite of what a reason for declining is typed for.
                        if (isPrimaryKey(e.nativeEvent, host.isApplePlatform())) {
                            e.preventDefault();
                        }
                    }}
                />
            )}
        </>
    );
}
