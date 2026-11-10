import { UI_CATALOG, UI_GROUPS, type UiGroupName } from './catalog.ts';
import { UI_FENCE_LANGUAGE } from './compiler.ts';
import { type UiBlock } from './compiler.ts';
import { uiDescription, uiPropList, uiRequirement, type UiPlaces } from './prop-list.ts';

export function uiCompactCatalog(places: UiPlaces = 'coordinates'): string {
    return Object.entries(UI_CATALOG)
        .map(([name, entry]) => {
            const props = uiPropList(entry, places).join(',');

            return `${name}${props ? `: ${props}` : ''}`;
        })
        .join(' · ');
}

export interface UiTextOptions {
    // The info string the host's compiler looks for; `UI_FENCE_LANGUAGE` without one.
    fenceLanguage?: string;
    // What the session note lists: every component with its props, or only the names per group.
    catalog?: 'props' | 'names';
    // With `names`, how the agent gets the props of a group, in the host's own words.
    detailHint?: string;
    // What the host does with a Place: `coordinates` (the default) when the agent must give lat and lon, `addresses` when the host also looks an address up.
    places?: UiPlaces;
}

function uiSyntax(language: string): string {
    return `Write XML-like component tags inside a fenced ${language} block. Put text between opening and closing tags; empty components end with />. Quote string props; put numbers, booleans and expressions in braces.`;
}

function uiExample(language: string): string {
    return [
        '```' + language,
        '$enabled = false',
        '<Summary badge="Draft">Release overview</Summary>',
        '<Stats><Stat label="Tests" value={42}/></Stats>',
        '<Switch value={$enabled}>Notify me</Switch>',
        '```'
    ].join('\n');
}

function uiGroupComponents(group: string) {
    return Object.entries(UI_CATALOG).filter(([, entry]) => entry.group === group);
}

/* One line per group with its components and what each needs, for a host that hands the optional props out per group. */
function uiGroupNames(detailHint: string | undefined, places: UiPlaces): string {
    const lines = Object.keys(UI_GROUPS).map(
        (group) =>
            `${group}: ${uiGroupComponents(group)
                .map(([name, entry]) => uiRequirement(name, entry, places))
                .join(', ')}`
    );

    return `Components by group${detailHint ? ` (${detailHint})` : ''}, required props (text: words between the tags):\n${lines.join('\n')}`;
}

export function uiSessionNote({ fenceLanguage = UI_FENCE_LANGUAGE, catalog = 'props', detailHint, places = 'coordinates' }: UiTextOptions = {}): string {
    const components = catalog === 'names' ? uiGroupNames(detailHint, places) : `Catalog (? means optional props): ${uiCompactCatalog(places)}`;

    return `${uiSyntax(fenceLanguage)} Prose outside. Only named catalog props, no styling. $name = literal JSON; input value={$name}; Button action={@Set($name, literal)}, {@Reset($name)} or {@Reset()} changes local state only; braced expressions: @Count, @Filter(list,row,predicate), @Sum, @Join, @Round. Show/Each control children. Choices are shortcuts after finished work that the person may ignore. When your turn would end waiting on the person (a missing fact, a decision, a go-ahead for work you would otherwise do), ask with your own question tool if you have one, otherwise in prose, never with Choices. Choice labels and precise context stay visible and send once. Image: attachment or generated="latest", never URL/path. Model only when the person asks to see one. No code execution. State resets on reload. ${components}\nExample:\n${uiExample(fenceLanguage)}\n`;
}

export interface UiComponentReference {
    name: string;
    description: string;
    /* A prop that ends in `?` is optional. */
    props: string[];
    /* A block that compiles, for a component whose use is not obvious from its props. */
    example?: string;
}

export interface UiGroupDescription {
    description: string;
    rules: string;
    components: UiComponentReference[];
}

/* A group as the catalog's data gives it, with the rules and props of a host that places as `places` says. */
export function uiGroupDescription(group: UiGroupName, places: UiPlaces = 'coordinates'): UiGroupDescription {
    const { description, rules, placing }: { description: string; rules: string; placing?: Record<UiPlaces, string> } = UI_GROUPS[group];

    return {
        description,
        rules: placing ? `${placing[places]} ${rules}` : rules,
        components: uiGroupComponents(group).map(([name, entry]) => ({
            name,
            description: uiDescription(entry, places),
            props: uiPropList(entry, places),
            ...('example' in entry ? { example: entry.example } : {})
        }))
    };
}

/* One group as the reference writes it: its description and rules, then every component with its props. */
export function uiGroupReference(group: UiGroupName, places: UiPlaces = 'coordinates'): string {
    const { description, rules, components } = uiGroupDescription(group, places);

    return [
        description,
        rules,
        ...components.map(
            (component) => `${component.name}: ${component.description}${component.props.length > 0 ? ` Props: ${component.props.join(', ')}.` : ''}`
        )
    ].join('\n');
}

export function uiReferenceText({ fenceLanguage = UI_FENCE_LANGUAGE, places = 'coordinates' }: UiTextOptions = {}): string {
    const groups = (Object.keys(UI_GROUPS) as UiGroupName[]).map((group) => uiGroupReference(group, places)).join('\n\n');

    return `${uiSyntax(fenceLanguage)}\nExample:\n${uiExample(fenceLanguage)}\n\n${groups}`;
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
