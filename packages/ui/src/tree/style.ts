export const TREE_ROW_HEIGHT = 25;

export function treeRowStyle(selector: string, selected = 'data-selected'): string {
    return `
        ${selector} {
            box-sizing: border-box;
            display: flex;
            position: relative;
            align-items: center;
            height: var(--tree-row-height, 25px);
            min-width: 0;
            gap: var(--tree-row-gap, 6px);
            border: 0;
            border-radius: var(--tree-row-radius, 6px);
            background: transparent;
            background-clip: padding-box;
            color: var(--text);
            font-family: var(--font-sans);
            font-size: var(--text-xs);
            line-height: var(--tree-row-height, 25px);
            text-align: start;
            outline: none;
        }
        ${selector}[data-interactive="true"]:hover { background: var(--surface-hover); }
        ${selector}[${selected}="true"] { background: var(--surface-active); color: var(--text); }
        ${selector}[data-joined-start="true"] { border-start-start-radius: 0; border-start-end-radius: 0; }
        ${selector}[data-joined-end="true"] { border-end-start-radius: 0; border-end-end-radius: 0; }
        ${selector}:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
    `;
}
