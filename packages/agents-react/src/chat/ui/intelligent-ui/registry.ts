import type { UiRenderers } from './render-context';
import { AlternativeRenderer, AlternativesRenderer, ConRenderer, ProRenderer } from './renderers/alternatives';
import { ChangeRenderer, ChangesRenderer } from './renderers/changes';
import { ChartRenderer } from './renderers/chart';
import { ChoiceRenderer, ChoicesRenderer } from './renderers/choices';
import { CodeBlockRenderer, CompareRenderer, GalleryRenderer, ImageRenderer, ModelRenderer, SourceRenderer, SourcesRenderer } from './renderers/content';
import { EntityListRenderer, EntryRenderer, StatRenderer, StatsRenderer, TableRenderer } from './renderers/data';
import { DiffRenderer } from './renderers/diff';
import {
    ButtonRenderer,
    ChecklistRenderer,
    ItemRenderer,
    NumberFieldRenderer,
    SegmentedRenderer,
    SelectRenderer,
    SliderRenderer,
    SwitchRenderer,
    TextFieldRenderer
} from './renderers/inputs';
import { KeysRenderer } from './renderers/keys';
import { CommitRenderer, FileRenderer, NodeRenderer } from './renderers/links';
import { MapRenderer } from './renderers/map';
import { MeterRenderer, PartsRenderer } from './renderers/meter';
import { QuoteRenderer } from './renderers/quote';
import { RadioRenderer } from './renderers/radio';
import { ColumnsRenderer, PaneRenderer, SectionRenderer, SectionsRenderer, TabRenderer, TabsRenderer } from './renderers/structure';
import {
    CalloutRenderer,
    EventRenderer,
    ProgressRenderer,
    StepRenderer,
    StepsRenderer,
    SummaryRenderer,
    TagRenderer,
    TimelineRenderer
} from './renderers/text';
import { BranchRenderer, LeafRenderer, TreeRenderer } from './renderers/tree';

/*
 * A renderer for every component of the catalog; a name missing here fails the typecheck. Null draws
 * nothing for the node itself: the runtime resolves Show and Each before rendering, and Column,
 * Option, Part and Place are metadata their parent reads from its node (a table its columns, Segmented,
 * Select and Radio their options, a bar its parts, a map its places).
 */
export const UI_RENDERERS: UiRenderers = {
    Summary: SummaryRenderer,
    Callout: CalloutRenderer,
    Tag: TagRenderer,
    Progress: ProgressRenderer,
    Steps: StepsRenderer,
    Step: StepRenderer,
    Timeline: TimelineRenderer,
    Event: EventRenderer,
    Stats: StatsRenderer,
    Stat: StatRenderer,
    Meter: MeterRenderer,
    Parts: PartsRenderer,
    Part: null,
    EntityList: EntityListRenderer,
    Entry: EntryRenderer,
    Table: TableRenderer,
    Column: null,
    Chart: ChartRenderer,
    Tabs: TabsRenderer,
    Tab: TabRenderer,
    Sections: SectionsRenderer,
    Section: SectionRenderer,
    Columns: ColumnsRenderer,
    Pane: PaneRenderer,
    Alternatives: AlternativesRenderer,
    Alternative: AlternativeRenderer,
    Pro: ProRenderer,
    Con: ConRenderer,
    Tree: TreeRenderer,
    Branch: BranchRenderer,
    Leaf: LeafRenderer,
    CodeBlock: CodeBlockRenderer,
    Quote: QuoteRenderer,
    Keys: KeysRenderer,
    Image: ImageRenderer,
    Gallery: GalleryRenderer,
    Compare: CompareRenderer,
    Model: ModelRenderer,
    Map: MapRenderer,
    Place: null,
    Sources: SourcesRenderer,
    Source: SourceRenderer,
    File: FileRenderer,
    Diff: DiffRenderer,
    Changes: ChangesRenderer,
    Change: ChangeRenderer,
    Commit: CommitRenderer,
    Node: NodeRenderer,
    Checklist: ChecklistRenderer,
    Item: ItemRenderer,
    Switch: SwitchRenderer,
    Slider: SliderRenderer,
    Segmented: SegmentedRenderer,
    Select: SelectRenderer,
    Radio: RadioRenderer,
    Option: null,
    TextField: TextFieldRenderer,
    NumberField: NumberFieldRenderer,
    Button: ButtonRenderer,
    Show: null,
    Each: null,
    Choices: ChoicesRenderer,
    Choice: ChoiceRenderer
};
