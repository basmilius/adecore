import { UI_CATALOG, UI_GROUPS } from './catalog.ts';
import { UI_FENCE_LANGUAGE, type UiBlock } from './compiler.ts';

export function uiCompactCatalog(): string {
    return Object.entries(UI_CATALOG)
        .map(([name, entry]) => {
            const props = Object.entries(entry.schema.shape)
                .map(([key, schema]) => `${key}${schema.isOptional() ? '?' : ''}`)
                .join(',');
            return `${name}(${props})`;
        })
        .join(' · ');
}

export function uiSessionNote(): string {
    return `Use fenced ${UI_FENCE_LANGUAGE} for structured results, comparisons and choices; prose outside. Only named catalog props, no styling. $name = literal JSON; input value={$name}; braced expressions: @Count, @Filter(list,row,predicate), @Sum, @Join, @Round. Show/Each control children. Choice labels and precise context stay visible and send once. Image: attachment or generated="latest", never URL/path. No code execution. State resets on reload. ${uiCompactCatalog()}`;
}

export function uiReferenceText(): string {
    return Object.entries(UI_GROUPS)
        .map(([group, definition]) => {
            const components = Object.entries(UI_CATALOG)
                .filter(([, entry]) => entry.group === group)
                .map(([name, entry]) => {
                    const props = Object.entries(entry.schema.shape)
                        .map(([key, schema]) => `${key}${schema.isOptional() ? '?' : ''}`)
                        .join(', ');
                    return `${name}(${props}): ${entry.description}`;
                });
            return [definition.description, definition.rules, ...components].join('\n');
        })
        .join('\n\n');
}

export function uiFallbackText(text: string, blocks: readonly UiBlock[]): string {
    let result = '';
    let position = 0;
    for (const block of [...blocks].sort((first, second) => first.start - second.start)) {
        if (block.start < position || block.end < block.start || block.end > text.length) {
            continue;
        }
        result += text.slice(position, block.start) + block.fallback + '\n';
        position = block.end;
    }
    return result + text.slice(position);
}
