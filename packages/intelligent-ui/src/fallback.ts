export function uiPlainText(value: unknown): string {
    return value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/* The readable text a node leaves behind where it cannot be drawn, from its props and its children's text. */
export function uiNodeFallback(type: string, props: Readonly<Record<string, unknown>>, children: string): string {
    const label = props.label ?? props.title;
    switch (type) {
        case '$text':
            return uiPlainText(props.text);
        case 'Stat':
            return `${uiPlainText(label)}: ${uiPlainText(props.value)}${props.unit ? ` ${uiPlainText(props.unit)}` : ''}\n`;
        case 'Source':
            return `${uiPlainText(label)}: ${uiPlainText(props.url)}\n`;
        case 'Table':
            return `${uiPlainText(props.rows ?? [])}\n`;
        case 'Chart':
            return `${uiPlainText(props.data ?? [])}\n`;
        case 'Image':
            return `[Image: ${uiPlainText(props.alt ?? props.attachment ?? props.generated ?? 'unavailable')}]${children}\n`;
    }
    const target = props.path ?? props.sha ?? (type === 'Node' ? props.id : undefined);
    const context = props.context ? `\n${uiPlainText(props.context)}` : '';
    const text = `${label !== undefined ? `${uiPlainText(label)}: ` : ''}${target !== undefined ? `${uiPlainText(target)} ` : ''}${children}${context}`;
    return type === 'Tag' || text.endsWith('\n') ? text : `${text}\n`;
}
