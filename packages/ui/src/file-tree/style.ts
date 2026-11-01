import { treeRowStyle } from '../tree/style.ts';
import { MATCH_HIGHLIGHT } from './highlight.ts';

// beta.6 splits the extension into nested grids; flatten them to truncate the end of the entire name.
export const FILE_TREE_CSS = `
    ${treeRowStyle('[data-type="item"]', 'data-item-selected')}
    [data-type="item"] { overflow: clip; padding-inline: 4px 8px; --trees-item-row-gap: var(--tree-row-gap, 6px); }
    [data-type="item"]::after {
        content: "";
        flex: none;
        order: -100;
        margin-inline: calc(var(--adecore-tree-shift, 0px) * -1) calc(var(--trees-item-row-gap) * -1);
    }
    [data-icon-name="file-tree-icon-chevron"] { width: 12px; height: 12px; }
    [data-item-section="spacing"] { padding: 0; margin-inline-end: -6px; }
    [data-item-section="spacing-item"] { position: relative; flex: none; width: 16px; margin: 0; border: 0; background: transparent; opacity: 1; transform: none; transition: none; }
    [data-item-section="spacing-item"] + [data-item-section="spacing-item"] { margin: 0; }
    [data-item-section="spacing-item"]::before { content: ""; position: absolute; inset-block: 0; inset-inline-start: 7px; width: 1px; background: var(--border); }
    [data-item-section="icon"] { width: 16px; margin-inline-start: var(--adecore-tree-control-space, 0px); }
    [data-item-section="content"] { white-space: nowrap; max-width: none; flex: 1 1 auto; margin-inline-end: var(--adecore-tree-decoration-space, 0px); }
    [data-item-section="content"] :where([data-truncate-group-container], [data-truncate-group-container] div, [data-truncate-container], [data-truncate-container] div) { display: inline; }
    [data-item-section="content"] [data-truncate-content] { direction: ltr; }
    [data-item-section="content"] :where([data-truncate-content="overflow"], [data-truncate-marker-cell], [data-truncate-fill]) { display: none; }
    [data-item-section="git"] { margin-inline-end: var(--adecore-tree-status-space, 0px); }
    /* The engine lifts the dot to the text's x-height; in a row of marks it belongs in the middle, with them. */
    [data-item-section="git"] [data-icon-name="file-tree-icon-dot"] { transform: none; }
    ::highlight(${MATCH_HIGHLIGHT}) { background-color: var(--match); color: inherit; }
    [data-tree-port] { position: absolute; z-index: 4; display: flex; align-items: center; height: 25px; pointer-events: none; }
    [data-tree-port] > slot { pointer-events: auto; }
    [data-tree-port="icon"] { width: 16px; justify-content: center; }
    [data-tree-port="icon"] > slot { pointer-events: none; }
    [data-own-icon="true"] [data-item-section="icon"] > * { visibility: hidden; }
    [data-own-icon="true"][data-item-type="folder"]:hover [data-item-section="icon"] > * { visibility: visible; }
    [data-tree-port="icon"][data-hover="true"] { visibility: hidden; }
    [data-empty-line="true"] { cursor: default; }
    [data-empty-line="true"] :is([data-item-section="icon"], [data-item-section="git"]) { display: none; }
    [data-empty-line="true"] [data-item-section="content"] { overflow: hidden; text-overflow: ellipsis; color: var(--text-muted); }
    [data-empty-line="true"] [data-item-section="content"] > * { display: none; }
    [data-empty-line="true"] [data-item-section="content"]::before { content: attr(data-empty-label); }
`;
