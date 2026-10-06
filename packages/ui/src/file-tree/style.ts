import { treeRowStyle } from '../tree/style.ts';

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
    [data-tree-port] { position: absolute; z-index: 4; display: flex; align-items: center; height: 25px; pointer-events: none; }
    [data-tree-port] > slot { pointer-events: auto; }
`;
