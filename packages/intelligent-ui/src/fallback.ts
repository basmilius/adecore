export function uiPlainText(value: unknown): string {
    return value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function given(value: unknown): boolean {
    return value !== undefined && value !== null && value !== '';
}

/*
 * The readable text a node leaves behind where it cannot be drawn, from its props and its children's text.
 * Another agent reads a reply through it too, so every prop that says something (a state, a detail, a
 * badge, a unit) is in it; only props that style a node or drive local state are left out.
 */
export function uiNodeFallback(type: string, props: Readonly<Record<string, unknown>>, children: string): string {
    const label = props.label ?? props.title;

    switch (type) {
        case '$text':
            return uiPlainText(props.text);
        case 'Summary':
            return `${children.trimEnd()}${given(props.badge) ? ` (${uiPlainText(props.badge)})` : ''}${given(props.detail) ? `: ${uiPlainText(props.detail)}` : ''}\n`;
        case 'Meter': {
            const unit = given(props.unit) ? ` ${uiPlainText(props.unit)}` : '';
            const mark = given(props.mark) ? `, mark at ${uiPlainText(props.mark)}` : '';
            const detail = given(props.detail) ? `: ${uiPlainText(props.detail)}` : '';

            return `${children.trimEnd()}: ${uiPlainText(props.value)} of ${uiPlainText(props.max ?? 100)}${unit}${mark}${detail}\n`;
        }
        case 'Part':
            return `${children.trim()}: ${uiPlainText(props.value)}\n`;
        case 'Parts':
            return given(props.unit) ? `${children.trimEnd()}\n(${uiPlainText(props.unit)})\n` : children;
        case 'Change': {
            const added = given(props.added) ? ` +${uiPlainText(props.added)}` : '';
            const removed = given(props.removed) ? ` -${uiPlainText(props.removed)}` : '';
            const counts = added || removed ? ` (${`${added}${removed}`.trim()})` : '';
            const state = given(props.state) ? `, ${uiPlainText(props.state)}` : '';

            return `${uiPlainText(props.path)}${counts}${state}${children.trim() ? `: ${children.trim()}` : ''}\n`;
        }
        case 'Alternative':
            return `${uiPlainText(props.title)}${props.recommended === true ? ' (recommended)' : ''}\n${children.trimEnd()}\n`;
        case 'Pro':
            return `\n+ ${children.trim()}`;
        case 'Con':
            return `\n- ${children.trim()}`;
        case 'Pane':
            return `${given(props.title) ? `${uiPlainText(props.title)}\n` : ''}${children.trimEnd()}\n`;
        case 'Branch':
            return `${uiPlainText(props.label)}\n${children
                .split('\n')
                .filter(Boolean)
                .map((line) => `  ${line}\n`)
                .join('')}`;
        case 'Leaf': {
            const name = children.trim();
            const path = given(props.path) ? uiPlainText(props.path) : '';

            return `${name || path}${name && path ? ` (${path})` : ''}${given(props.detail) ? `: ${uiPlainText(props.detail)}` : ''}\n`;
        }
        case 'Tab':
        case 'Section': {
            const text = `${uiPlainText(props.title)}${given(props.badge) ? ` (${uiPlainText(props.badge)})` : ''}: ${children}`;

            return text.endsWith('\n') ? text : `${text}\n`;
        }
        case 'CodeBlock': {
            const file = given(props.file) ? `${uiPlainText(props.file)}${given(props.start) ? `:${uiPlainText(props.start)}` : ''}\n` : '';
            const text = `${file}${children}`;

            return text.endsWith('\n') ? text : `${text}\n`;
        }
        case 'Item':
        case 'Option':
            if (given(props.detail)) {
                return `${children.trimEnd()}: ${uiPlainText(props.detail)}\n`;
            }

            break;
        case 'NumberField':
            return `${children.trim()}: ${uiPlainText(props.value)}${given(props.unit) ? ` ${uiPlainText(props.unit)}` : ''}\n`;
        case 'Quote':
            return `"${children.trim()}"${given(props.source) ? ` (${uiPlainText(props.source)})` : ''}\n`;
        case 'Keys':
            return children;
        case 'Step':
            return `${children.trimEnd()}${given(props.state) ? ` (${uiPlainText(props.state)})` : ''}${given(props.detail) ? `: ${uiPlainText(props.detail)}` : ''}\n`;
        case 'Event':
            return `${uiPlainText(props.at)} ${children.trimEnd()}${given(props.tone) ? ` (${uiPlainText(props.tone)})` : ''}${given(props.detail) ? `: ${uiPlainText(props.detail)}` : ''}\n`;
        case 'Progress':
            return `${children.trimEnd()}${given(props.value) ? `: ${uiPlainText(props.value)} of ${uiPlainText(props.max ?? 100)}` : ''}${given(props.detail) ? ` (${uiPlainText(props.detail)})` : ''}\n`;
        case 'Stat': {
            const unit = given(props.unit) ? ` ${uiPlainText(props.unit)}` : '';
            const previous = given(props.previous) ? ` (was ${uiPlainText(props.previous)}${unit})` : '';

            return `${uiPlainText(label)}: ${uiPlainText(props.value)}${unit}${previous}\n`;
        }
        case 'Source':
            return `${uiPlainText(label)}: ${uiPlainText(props.url ?? props.node)}\n`;
        case 'Column':
            return `${uiPlainText(props.title ?? props.key)}${given(props.unit) ? ` (${uiPlainText(props.unit)})` : ''}\n`;
        case 'Table': {
            const columns = children
                .split('\n')
                .map((column) => column.trim())
                .filter(Boolean);

            return `${columns.length > 0 ? `Columns: ${columns.join(', ')}\n` : ''}${uiPlainText(props.rows ?? [])}\n`;
        }
        case 'Chart':
            return `${given(props.title) ? `${uiPlainText(props.title)}\n` : ''}${uiPlainText(props.data ?? [])}${given(props.unit) ? ` (${uiPlainText(props.unit)})` : ''}\n`;
        case 'Compare':
            return `[Compare: ${uiPlainText(props.beforeLabel || 'Before')} ${uiPlainText(props.before)}, ${uiPlainText(props.afterLabel || 'After')} ${uiPlainText(props.after)}]${children.trim() ? ` ${children.trim()}` : ''}\n`;
        case 'Place': {
            const point = given(props.lat) && given(props.lon) ? ` (${uiPlainText(props.lat)}, ${uiPlainText(props.lon)})` : '';
            const address = given(props.address) ? `, ${uiPlainText(props.address)}` : '';
            const detail = given(props.detail) ? `: ${uiPlainText(props.detail)}` : '';

            // One line per place, so the numbering of its map counts places and not the lines of a name.
            return `${children.trim()}${point}${address}${detail}`.replace(/\s+/g, ' ').trim() + '\n';
        }
        case 'Map':
            // The places are numbered where the compiler joins them, since only it knows which of the children drew.
            return children;
        case 'Image':
            return `[Image: ${uiPlainText(props.alt ?? props.attachment ?? props.generated ?? 'unavailable')}]${children}\n`;
        case 'Model':
            return `[Model: ${uiPlainText(props.alt ?? props.attachment ?? 'unavailable')}]${children.trim() ? ` ${children.trim()}` : ''}\n`;
    }

    const path = given(props.path) && given(props.line) ? `${uiPlainText(props.path)}:${uiPlainText(props.line)}` : props.path;
    const target = path ?? props.sha ?? (type === 'Node' ? props.id : undefined);
    const context = props.context ? `\n${uiPlainText(props.context)}` : '';
    const text = `${label !== undefined ? `${uiPlainText(label)}: ` : ''}${target !== undefined ? `${uiPlainText(target)} ` : ''}${children}${context}`;

    return type === 'Tag' || text.endsWith('\n') ? text : `${text}\n`;
}
