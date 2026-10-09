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
    return `For a result, comparison or choice that benefits from an interface, put a fenced ${UI_FENCE_LANGUAGE} block in your final reply, with explanation outside it. Use catalog tags with named props; no layout, style or color props. State: $name = literal JSON on a line above the tags. Bind local inputs with value={$name}; use braced expressions and @Count, @Filter(list,row,predicate), @Sum, @Join, @Round. Show(when) and Each(items,as) control children. End decisions with Choices; each Choice has a short label and precise context shown to the person. Image takes a chat attachment or generated="latest", never a URL or path. No executable code. Local state resets on reload. ${uiCompactCatalog()}`;
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
