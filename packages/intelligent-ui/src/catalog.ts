import { z } from 'zod';
import { UI_TONES, uiDescription, uiPropList, type UiPlaces } from './prop-list.ts';

export const UI_CATALOG_VERSION = 1;
export const UiToneSchema = z.enum(UI_TONES);
export type UiTone = z.infer<typeof UiToneSchema>;

const text = z.string().max(16384);
const name = z.string().min(1).max(256);
const number = z.number().finite();
const scalar = z.union([text, number, z.boolean(), z.null()]);
const rows = z.array(z.record(z.string(), z.unknown())).max(1000);
const empty = z.strictObject({});
const tone = UiToneSchema.optional();

export const UI_GROUPS = {
    status: { description: 'Summarize a result or show progress.', rules: 'Use one leading Summary. Children are inline prose, not headings or tables.' },
    data: { description: 'Compare values and records.', rules: 'Give numbers as numbers. Tone expresses meaning, never infer it from an increase.' },
    structure: { description: 'Organize distinct topics.', rules: 'Use Tabs for alternatives and Sections for independent topics.' },
    content: {
        description: 'Include code, attachments and sources.',
        rules: 'Image accepts a chat attachment or generated="latest", never a URL or a local path. Gallery and Compare take chat attachments too. Model takes a chat attachment of a model file, and is shown only when the person asks to see a model, never on your own after writing or changing one. The host says how to attach a file of your own.'
    },
    places: {
        description: 'Show places on a map the host draws.',
        rules: 'Never a tile or map URL. The host chooses the map.',
        placing: {
            coordinates: 'Give lat and lon in decimal degrees for every Place.',
            addresses: 'Give lat and lon in decimal degrees, or an address the host looks up.'
        }
    },
    links: { description: 'Refer to a host-owned resource.', rules: 'The host checks every target. No arbitrary navigation or file reads.' },
    inputs: {
        description: 'Change local block state.',
        rules: 'Bind value={$name}. A Button sets a literal with action={@Set($name, value)} or restores a default with {@Reset($name)} or {@Reset()}. State stays local until a Choice sends visible context.'
    },
    choices: {
        description: 'Offer shortcuts after finished work that the person may ignore.',
        rules: 'Never a question your turn waits on (a missing fact, a decision, a go-ahead for work you would otherwise do): ask that with your own question tool if you have one, otherwise in prose. Give a short label and precise visible context. A Choice sends once after streaming ends.'
    }
} as const;

export const UI_CATALOG = {
    Summary: {
        group: 'status',
        description: 'The result in one sentence.',
        schema: z.strictObject({ tone, badge: text.optional() }),
        content: 'title',
        aliases: { status: 'tone', variant: 'tone', type: 'tone' },
        example: '<Summary tone="success" badge="v2.4.0">The release is live</Summary>'
    },
    Callout: {
        group: 'status',
        description: 'A note that needs attention.',
        schema: z.strictObject({ tone: UiToneSchema.default('info'), title: text.optional() }),
        needs: 'tone',
        content: 'text',
        aliases: { type: 'tone', variant: 'tone', kind: 'tone', label: 'title' },
        example: '<Callout tone="warning" title="Migration needed">Run the migration before you deploy.</Callout>'
    },
    Tag: {
        group: 'status',
        description: 'A short status label.',
        schema: z.strictObject({ tone }),
        content: 'label',
        aliases: { type: 'tone', variant: 'tone', color: 'tone' },
        example: '<Tag tone="success">passed</Tag>'
    },
    Progress: {
        group: 'status',
        description: 'Progress with a label; omit value for indeterminate progress.',
        schema: z.strictObject({ value: number.nonnegative().optional(), max: number.positive().optional() }),
        text: 'label',
        quantity: { props: ['value', 'max'] },
        example: '<Progress value={7} max={12}>Files migrated</Progress>'
    },
    Steps: {
        group: 'status',
        description: 'An ordered sequence of steps.',
        schema: empty,
        children: ['Step'],
        example: '<Steps><Step state="done" detail="4 min">Unit tests</Step><Step state="running">Integration</Step><Step>Release</Step></Steps>'
    },
    Step: {
        group: 'status',
        description: 'One step in a sequence.',
        schema: z.strictObject({ state: z.enum(['done', 'running', 'pending', 'failed', 'skipped']).default('pending'), detail: text.optional() }),
        parent: 'Steps',
        needs: 'state=done|running|pending|failed|skipped',
        text: 'label',
        aliases: { status: 'state', description: 'detail' }
    },
    Timeline: {
        group: 'status',
        description: 'Events in time order.',
        schema: empty,
        children: ['Event'],
        count: { min: 1 },
        example: '<Timeline><Event at="09:12">Tag pushed</Event><Event at="09:58" tone="success" detail="Latest">Release published</Event></Timeline>'
    },
    Event: {
        group: 'status',
        description:
            'One event at a time or date; children are the title. at is HH:MM[:SS], YYYY-MM-DD, or YYYY-MM-DDTHH:MM[:SS] with an optional Z or ±HH:MM.',
        schema: z.strictObject({
            at: text,
            tone,
            detail: text.optional()
        }),
        parent: 'Timeline',
        text: 'title',
        aliases: { time: 'at', date: 'at' }
    },
    Stats: {
        group: 'data',
        description: 'A small set of key numbers.',
        schema: empty,
        children: ['Stat'],
        example: '<Stats><Stat label="Tests" value={6777} previous={6412} tone="success"/><Stat label="CI" value={21.6} unit="min"/></Stats>'
    },
    Stat: {
        group: 'data',
        description: 'A labeled number with an optional previous number, or a value in words.',
        schema: z.strictObject({ label: text, value: z.union([number, text]), previous: number.optional(), unit: text.optional(), tone }),
        parent: 'Stats',
        aliases: { title: 'label', name: 'label', prev: 'previous', suffix: 'unit' },
        quantity: { props: ['value', 'previous'], unit: 'unit' },
        textProp: 'value'
    },
    EntityList: {
        group: 'data',
        description: 'Labeled facts about an entity.',
        schema: empty,
        children: ['Entry'],
        example: '<EntityList><Entry label="ci">21 min 38 sec</Entry><Entry label="far-future-clock">16 min 46 sec</Entry></EntityList>'
    },
    Entry: {
        group: 'data',
        description: 'One labeled fact.',
        schema: z.strictObject({ label: text }),
        parent: 'EntityList',
        text: 'value',
        aliases: { title: 'label', name: 'label', key: 'label' }
    },
    Table: {
        group: 'data',
        description: 'Rows with named columns.',
        schema: z.strictObject({ rows }),
        children: ['Column'],
        aliases: { data: 'rows' },
        example:
            '<Table rows={[{"job": "Unit", "ms": 262000, "status": "passed"}]}><Column key="job" title="Job"/><Column key="ms" title="Duration" as="duration"/><Column key="status" as="tag"/></Table>'
    },
    Column: {
        group: 'data',
        description: 'A field of each table row.',
        schema: z.strictObject({
            key: name,
            title: text.optional(),
            unit: text.optional(),
            as: z.enum(['text', 'number', 'bytes', 'duration', 'date', 'file', 'tag']).optional()
        }),
        parent: 'Table',
        aliases: { label: 'title', name: 'title', field: 'key', type: 'as', format: 'as' }
    },
    Chart: {
        group: 'data',
        description: 'Compare labeled numeric series. Data rows have label and up to six numeric series.',
        schema: z.strictObject({
            kind: z.enum(['bar', 'hbar', 'stacked', 'line']),
            data: z.array(z.record(z.string(), scalar)).max(1000),
            unit: text.optional()
        }),
        aliases: { type: 'kind', rows: 'data' },
        series: { prop: 'data', label: 'label', unit: 'unit' },
        example: '<Chart kind="stacked" data={[{"label": "Core", "passed": 32, "failed": 1}, {"label": "Client", "passed": 58, "failed": 4}]}/>'
    },
    Tabs: {
        group: 'structure',
        description: 'Switch between alternative topics.',
        schema: empty,
        children: ['Tab'],
        example: '<Tabs><Tab title="Summary">The release is live.</Tab><Tab title="Files">Three files changed.</Tab></Tabs>'
    },
    Tab: {
        group: 'structure',
        description: 'A named tab.',
        schema: z.strictObject({ title: text }),
        parent: 'Tabs',
        aliases: { label: 'title', name: 'title' }
    },
    Sections: {
        group: 'structure',
        description: 'Independent collapsible topics.',
        schema: empty,
        children: ['Section'],
        example:
            '<Sections><Section title="What changed">Three handlers read the revision first.</Section><Section title="Risks">None found.</Section></Sections>'
    },
    Section: {
        group: 'structure',
        description: 'A named section.',
        schema: z.strictObject({ title: text }),
        parent: 'Sections',
        aliases: { label: 'title', name: 'title' }
    },
    CodeBlock: {
        group: 'content',
        description: 'Code as text, without execution.',
        schema: z.strictObject({ language: name.optional() }),
        aliases: { lang: 'language' },
        example: '<CodeBlock language="ts">const total = rows.length;</CodeBlock>'
    },
    Image: {
        group: 'content',
        description: 'A chat attachment with an optional caption.',
        schema: z
            .strictObject({ attachment: name.optional(), generated: z.literal('latest').optional(), alt: text.optional() })
            .refine(
                (props) => Boolean(props.attachment) !== Boolean(props.generated),
                'Give attachment="<id>" or generated="latest", exclusively; a URL or a path is never loaded.'
            ),
        needs: 'attachment|generated',
        text: 'caption',
        example: '<Image attachment="att_1" alt="The settings screen">Settings after the change</Image>'
    },
    Gallery: {
        group: 'content',
        description: 'A grid of images with captions; at most 24.',
        schema: empty,
        children: ['Image'],
        count: { min: 1, max: 24 },
        example: '<Gallery><Image attachment="att_1">Light</Image><Image attachment="att_2">Dark</Image></Gallery>'
    },
    Compare: {
        group: 'content',
        description: 'Two chat attachments in one frame with a handle to wipe between them; children are the caption.',
        schema: z.strictObject({ before: name, after: name, beforeLabel: text.optional(), afterLabel: text.optional() }),
        text: 'caption',
        example: '<Compare before="att_1" after="att_2" beforeLabel="Before" afterLabel="After">The sidebar is narrower.</Compare>'
    },
    Model: {
        group: 'content',
        description: 'A 3D model from a chat attachment that a person can orbit and zoom; children are the caption.',
        schema: z.strictObject({ attachment: name, alt: text.optional() }),
        needs: 'attachment',
        text: 'caption',
        example: '<Model attachment="att_1" alt="The housing">The housing with the new clip</Model>'
    },
    Map: {
        group: 'places',
        description: 'One to 50 places on a map the host draws, with a numbered list under it; bind value to let a person pick a place.',
        schema: z.strictObject({ value: scalar.optional() }),
        children: ['Place'],
        binding: 'value',
        count: { min: 1, max: 50 },
        example: '<Map><Place lat={52.0907} lon={5.1214} detail="Open until 18:00">The Village Coffee</Place></Map>'
    },
    Place: {
        group: 'places',
        description: 'One place by lat and lon. Children are the name.',
        lookup: {
            prop: 'address',
            description:
                'One place by lat and lon, or by an address the host looks up; with both, the point the host finds for the address wins and lat and lon stand when it finds none. Children are the name.',
            needs: 'lat={number} lon={number}|address'
        },
        schema: z
            .strictObject({
                lat: number.min(-90).max(90).optional(),
                lon: number.min(-180).max(180).optional(),
                address: text.max(512).optional(),
                detail: text.optional(),
                value: scalar.optional()
            })
            .refine(
                (props) => (props.lat === undefined) === (props.lon === undefined) && (props.lat !== undefined || props.address !== undefined),
                'Give lat with lon, or an address.'
            ),
        parent: 'Map',
        needs: 'lat={number} lon={number}',
        text: 'name',
        aliases: { lng: 'lon', long: 'lon', longitude: 'lon', latitude: 'lat' }
    },
    Sources: {
        group: 'content',
        description: 'Numbered sources without preloading.',
        schema: empty,
        children: ['Source'],
        example: '<Sources><Source title="The API reference" url="https://example.com/api"/></Sources>'
    },
    Source: {
        group: 'content',
        description: 'An HTTP or HTTPS source by url, or a host node by its id; exactly one.',
        schema: z
            .strictObject({ title: text, url: text.regex(/^https?:\/\//i).optional(), node: name.optional() })
            .refine((props) => (props.url === undefined) !== (props.node === undefined), 'Give url or node, exclusively.'),
        parent: 'Sources',
        needs: 'title url|node'
    },
    File: {
        group: 'links',
        description: 'A file in the project or a worktree.',
        schema: z.strictObject({ path: text, line: number.int().positive().max(10000000).optional() }),
        example: '<File path="src/compiler.ts" line={335}>Where the props are checked</File>'
    },
    Diff: {
        group: 'links',
        description: 'A changed project file.',
        schema: z.strictObject({ path: text }),
        example: '<Diff path="src/compiler.ts">Reads a number written as text</Diff>'
    },
    Commit: {
        group: 'links',
        description: 'A repository commit.',
        schema: z.strictObject({ sha: z.string().regex(/^[a-f\d]{7,64}$/i) }),
        example: '<Commit sha="30e7316e3">The version bump</Commit>'
    },
    Node: {
        group: 'links',
        description: 'A host node.',
        schema: z.strictObject({ id: name }),
        example: '<Node id="node_1">The chat that did the research</Node>'
    },
    Checklist: {
        group: 'inputs',
        description: 'Select values in a local list.',
        schema: z.strictObject({ value: z.array(scalar).max(1000) }),
        children: ['Item'],
        binding: 'value',
        implicit: [],
        example: '$picked = ["types"]\n<Checklist value={$picked}><Item value="types">Types</Item><Item value="aliases">Aliases</Item></Checklist>'
    },
    Item: { group: 'inputs', description: 'One selectable value.', schema: z.strictObject({ value: scalar }), parent: 'Checklist', text: 'label' },
    Switch: {
        group: 'inputs',
        description: 'A local boolean.',
        schema: z.strictObject({ value: z.boolean() }),
        binding: 'value',
        text: 'label',
        example: '$notify = true\n<Switch value={$notify}>Tell me when the run is done</Switch>'
    },
    Slider: {
        group: 'inputs',
        description: 'A local number in a range.',
        schema: z
            .strictObject({ value: number, min: number, max: number, step: number.positive().optional(), unit: text.optional() })
            .refine((props) => props.min < props.max && props.value >= props.min && props.value <= props.max, 'Value must lie within an increasing range.'),
        binding: 'value',
        text: 'label',
        example: '$runs = 50\n<Slider value={$runs} min={10} max={200} step={10} unit="runs">Number of runs</Slider>'
    },
    Segmented: {
        group: 'inputs',
        description: 'Choose one local value.',
        schema: z.strictObject({ value: scalar }),
        children: ['Option'],
        binding: 'value',
        example: '$env = "staging"\n<Segmented value={$env}><Option value="dev">Dev</Option><Option value="staging">Staging</Option></Segmented>'
    },
    Select: {
        group: 'inputs',
        description: 'Choose one local value from a dropdown, for more or longer options than Segmented holds; the text beside its Options is its label.',
        schema: z.strictObject({ value: scalar }),
        children: ['Option'],
        binding: 'value',
        text: 'label',
        example: '$model = "small"\n<Select value={$model}>Model<Option value="small">Small</Option><Option value="large">Large</Option></Select>'
    },
    Option: {
        group: 'inputs',
        description: 'One local alternative.',
        schema: z.strictObject({ value: scalar }),
        parent: ['Segmented', 'Select'],
        text: 'label'
    },
    TextField: {
        group: 'inputs',
        description: 'A line of local text up to maxLength characters (256 without one, at most 1024); children are the label.',
        schema: z
            .strictObject({ value: text, maxLength: z.number().int().min(1).max(1024).optional(), placeholder: text.max(128).optional() })
            .refine((props) => props.value.length <= (props.maxLength ?? 256), 'Value must not be longer than maxLength.'),
        binding: 'value',
        text: 'label',
        example: '$name = ""\n<TextField value={$name} placeholder="feat/..." maxLength={64}>Branch name</TextField>'
    },
    Button: {
        group: 'inputs',
        description: 'Run one local state action when pressed; children are the label.',
        schema: z.strictObject({ disabled: z.boolean().optional() }),
        action: 'action',
        text: 'label',
        aliases: { onClick: 'action', onPress: 'action' },
        example: '$name = "main"\n<Button action={@Reset($name)}>Clear</Button>'
    },
    Show: {
        group: 'inputs',
        description: 'Show children when the condition is true.',
        schema: z.strictObject({ when: z.boolean() }),
        example: '$details = true\n<Show when={$details}><Tag>unit</Tag></Show>'
    },
    Each: {
        group: 'inputs',
        description: 'Repeat children over local data.',
        schema: z.strictObject({ items: z.array(z.unknown()).max(1000), as: name.regex(/^[A-Za-z_][A-Za-z_\d]*$/) }),
        example: '$jobs = [{"name": "unit"}, {"name": "dom"}]\n<Each items={$jobs} as="job"><Tag>{job.name}</Tag></Each>'
    },
    Choices: {
        group: 'choices',
        description: 'Shortcuts after finished work, never a question you wait on.',
        schema: empty,
        children: ['Choice'],
        example: '<Choices><Choice primary context="Commit the three files and push">Commit and push</Choice><Choice>Not yet</Choice></Choices>'
    },
    Choice: {
        group: 'choices',
        description: 'Send its label and visible context once.',
        schema: z.strictObject({ context: text.optional(), primary: z.boolean().optional(), disabled: z.boolean().optional() }),
        parent: 'Choices',
        text: 'label'
    }
} as const;

export type UiGroupName = keyof typeof UI_GROUPS;
export type UiComponentName = keyof typeof UI_CATALOG;
export type UiProps<Name extends UiComponentName> = z.infer<(typeof UI_CATALOG)[Name]['schema']>;

export function isUiComponent(name: string): name is UiComponentName {
    return Object.hasOwn(UI_CATALOG, name);
}

export function uiCatalogText(places: UiPlaces = 'coordinates'): string {
    return Object.entries(UI_CATALOG)
        .map(([name, entry]) => `${name}(${uiPropList(entry, places).join(', ')}): ${uiDescription(entry, places)}`)
        .join('\n');
}
