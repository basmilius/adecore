import type { UiProps } from '@adecore/intelligent-ui';
import { FileIcon, Icon } from '@adecore/ui';
import clsx from 'clsx';
import { Folder, FolderOpen } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useBlockLocal } from '../block-local';
import { uiBaseName, uiLinkAction } from '../link-action';
import { uiNodeLabel } from '../node-text';
import type { UiRendererProps } from '../render-context';
import { UI_TONE_TEXT } from '../tones';

const ROW = 'flex min-h-7 min-w-0 items-center gap-2 font-mono text-code';

/* Nested lists, so a screen reader hears the depth and the count without a tree's own keyboard model. */
export function TreeRenderer({ children }: UiRendererProps<UiProps<'Tree'>>) {
    const { t } = useTranslation('agent-chat');

    return (
        <ul aria-label={t('blocks.tree.label')} className="chat-ui-nodes chat-ui-flat flex flex-col rounded-xl bg-ui-tile px-3 py-2">
            {children}
        </ul>
    );
}

/* Open unless it arrives closed; what a person folds stays folded as long as the page lasts. */
export function BranchRenderer({ node, children, context }: UiRendererProps<UiProps<'Branch'>>) {
    const [open, setOpen] = useBlockLocal(context, node.id, () => node.props.open !== false);
    const contentId = useId();

    return (
        <li className="flex min-w-0 flex-col">
            <button
                type="button"
                aria-expanded={open}
                aria-controls={contentId}
                className={clsx(ROW, '-mx-1.5 rounded-md px-1.5 text-left text-text hover:bg-text/4')}
                onClick={() => setOpen(!open)}
            >
                <Icon icon={open ? FolderOpen : Folder} size={14} className="shrink-0 text-text-muted" />
                <span className="min-w-0 truncate">{node.props.label}</span>
            </button>
            <ul id={contentId} hidden={!open} className="chat-ui-nodes flex flex-col pl-4">
                {children}
            </ul>
        </li>
    );
}

/*
 * Named by its children, or by its file without them. With a path the host can open, the name opens it
 * as a File link does; one it cannot stays the same text, since a tree shows a structure before it links.
 */
export function LeafRenderer({ node, children, context }: UiRendererProps<UiProps<'Leaf'>>) {
    const { t } = useTranslation('agent-chat');
    const { path, detail, tone } = node.props;
    const written = uiNodeLabel(node) !== '';
    const name = written ? children : path === undefined ? null : uiBaseName(path);
    const open = path === undefined ? null : uiLinkAction(t, { type: 'File', path }, context).open;
    const look = clsx('min-w-0 truncate', tone === undefined ? 'text-text' : UI_TONE_TEXT[tone]);

    return (
        <li className={ROW}>
            {path === undefined ? (
                <span aria-hidden className="grid size-3.5 shrink-0 place-items-center">
                    <span className="size-1 rounded-full bg-text-faint" />
                </span>
            ) : (
                <FileIcon path={path} size={14} className="shrink-0" />
            )}
            {open === null ? (
                <span className={look}>{name}</span>
            ) : (
                <button type="button" className={clsx(look, 'rounded-sm text-left hover:underline')} onClick={open}>
                    {name}
                </button>
            )}
            {tone !== undefined && tone !== 'neutral' && <span className="sr-only">{t(`blocks.event.tone.${tone}`)}</span>}
            {detail !== undefined && detail !== '' && (
                <span className="ml-auto max-w-1/2 shrink-0 truncate pl-2 font-sans text-2xs text-text-muted">{detail}</span>
            )}
        </li>
    );
}
