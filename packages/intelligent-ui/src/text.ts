import { UI_CATALOG, UI_GROUPS } from './catalog.ts';
import { UI_FENCE_LANGUAGE, type UiBlock } from './compiler.ts';

export function uiCompactCatalog(): string {
    return Object.entries(UI_CATALOG)
        .map(([name, entry]) => {
            const props = Object.entries(entry.schema.shape)
                .map(([key, schema]) => `${key}${schema.isOptional() ? '?' : ''}`)
                .join(',');
            return `${name}${props ? `: ${props}` : ''}`;
        })
        .join(' · ');
}

const UI_SYNTAX = `Write XML-like component tags inside a fenced ${UI_FENCE_LANGUAGE} block. Put text between opening and closing tags; empty components end with />. Quote string props; put numbers, booleans and expressions in braces.`;
const UI_EXAMPLE = [
    '```' + UI_FENCE_LANGUAGE,
    '$enabled = false',
    '<Summary badge="Draft">Release overview</Summary>',
    '<Stats><Stat label="Tests" value={42}/></Stats>',
    '<Switch value={$enabled}>Notify me</Switch>',
    '<Choices><Choice context="Review the release overview">Continue</Choice></Choices>',
    '```'
].join('\n');

export function uiSessionNote(): string {
    return `${UI_SYNTAX} Prose outside. Only named catalog props, no styling. $name = literal JSON; input value={$name}; braced expressions: @Count, @Filter(list,row,predicate), @Sum, @Join, @Round. Show/Each control children. Choice labels and precise context stay visible and send once. Image: attachment or generated="latest", never URL/path. No code execution. State resets on reload. Catalog (? means optional props): ${uiCompactCatalog()}\nExample:\n${UI_EXAMPLE}\n`;
}

export function uiReferenceText(): string {
    const groups = Object.entries(UI_GROUPS)
        .map(([group, definition]) => {
            const components = Object.entries(UI_CATALOG)
                .filter(([, entry]) => entry.group === group)
                .map(([name, entry]) => {
                    const props = Object.entries(entry.schema.shape)
                        .map(([key, schema]) => `${key}${schema.isOptional() ? '?' : ''}`)
                        .join(', ');
                    return `${name}: ${entry.description}${props ? ` Props: ${props}.` : ''}`;
                });
            return [definition.description, definition.rules, ...components].join('\n');
        })
        .join('\n\n');
    return `${UI_SYNTAX}\nExample:\n${UI_EXAMPLE}\n\n${groups}`;
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
