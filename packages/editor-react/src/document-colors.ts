import type { EditorContentChange, EditorInlayClick, EditorInlayHint } from '@adecore/editor';
import type { Color, ColorInformation, ColorPresentation, TextEdit } from '@adecore/lsp';
import { DocumentQuery } from './document-query.ts';
import type { EditorLanguage } from './editor-language.ts';
import { realTimers, type Timers } from './timers.ts';

const METHOD = 'textDocument/documentColor';
const OWNER = 'document-colors';
const DELAY_MS = 500;
const ID_PREFIX = 'color-';
const OTHER_COLOR = 'other';

/* A color of LSP, each part from 0 to 1, as CSS draws it. */
export function cssColorOf(color: Color): string {
    const part = (value: number): string => String(Math.round(Math.min(1, Math.max(0, value)) * 1000) / 1000);
    return `color(srgb ${part(color.red)} ${part(color.green)} ${part(color.blue)} / ${part(color.alpha)})`;
}

/* `#rrggbb` of an `<input type="color">` as a color of LSP, opaque. */
export function colorOfHex(value: string): Color | null {
    const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
    if (match === null) {
        return null;
    }
    return { red: parseInt(match[1]!, 16) / 255, green: parseInt(match[2]!, 16) / 255, blue: parseInt(match[3]!, 16) / 255, alpha: 1 };
}

function hexOf(color: Color): string {
    const part = (value: number): string =>
        Math.round(Math.min(1, Math.max(0, value)) * 255)
            .toString(16)
            .padStart(2, '0');
    return `#${part(color.red)}${part(color.green)}${part(color.blue)}`;
}

/* The edits a presentation makes: its own text edit, or its label over the color, and the edits that come with it. */
export function presentationEdits(presentation: ColorPresentation, information: ColorInformation): TextEdit[] {
    return [presentation.textEdit ?? { range: information.range, newText: presentation.label }, ...(presentation.additionalTextEdits ?? [])];
}

/*
 * The colors a server finds in the text, such as `#ff0000` in a stylesheet, each with a swatch before it. A press on
 * a swatch lists the ways the server writes that color, so `rgb()` can become `#hex`, and offers a color of the
 * platform's picker, which keeps the way the color was written when the server offers it.
 */
export class DocumentColorsFeature {
    private readonly language: EditorLanguage;
    private colors: readonly ColorInformation[] = [];
    private readonly query: DocumentQuery<ColorInformation[]>;
    private enabled = true;

    constructor(language: EditorLanguage, timers: Timers = realTimers) {
        this.language = language;
        this.query = new DocumentQuery(
            language,
            timers,
            DELAY_MS,
            (signal) => (this.enabled && this.supported ? language.service.documentColors!(language.uri, { signal }) : Promise.resolve(null)),
            (colors) => this.show(colors ?? [])
        );
        const { editor } = language;
        if (editor.onInlayClick !== undefined) {
            language.onDispose(editor.onInlayClick((click) => this.pressed(click)));
        }
        language.onDispose(() => editor.setInlayHints([], OWNER));
    }

    get supported(): boolean {
        const { service } = this.language;
        return service.documentColors !== undefined && service.supports(METHOD, this.language.uri);
    }

    /* The colors of the current text, empty while an edit waits for the next answer. */
    all(): readonly ColorInformation[] {
        return this.colors;
    }

    /* Off, there are no swatches; on unless false. */
    configure(settings: { readonly enabled?: boolean }): void {
        this.enabled = settings.enabled !== false;
        if (this.enabled) {
            this.query.run();
        } else {
            this.show([]);
        }
    }

    /* The ways the server writes a color found in the text, for a menu of the host. */
    async presentations(information: ColorInformation, color: Color = information.color): Promise<ColorPresentation[]> {
        const { service } = this.language;
        if (service.colorPresentations === undefined) {
            return [];
        }
        try {
            return (await service.colorPresentations(this.language.uri, color, information.range)) ?? [];
        } catch {
            return [];
        }
    }

    /* Writes a presentation in place of the color it was asked for; false when the text moved on since. */
    apply(presentation: ColorPresentation, information: ColorInformation): boolean {
        if (!this.colors.includes(information)) {
            return false;
        }
        const changes: EditorContentChange[] = presentationEdits(presentation, information).map((edit) => ({ range: edit.range, text: edit.newText }));
        return this.language.editor.applyEdits(changes);
    }

    private show(colors: readonly ColorInformation[]): void {
        this.colors = colors;
        const hints: EditorInlayHint[] = colors.map((information, index) => ({
            id: `${ID_PREFIX}${index}`,
            position: information.range.start,
            label: this.language.project.i18n.t('editor:language.colors.swatch', { color: hexOf(information.color) }),
            swatch: cssColorOf(information.color),
            paddingRight: true
        }));
        this.language.editor.setInlayHints(hints, OWNER);
    }

    private pressed(click: EditorInlayClick): boolean {
        if (!click.id.startsWith(ID_PREFIX)) {
            return false;
        }
        const information = this.colors[Number(click.id.slice(ID_PREFIX.length))];
        if (information === undefined) {
            return false;
        }
        void this.open(information);
        return true;
    }

    private async open(information: ColorInformation): Promise<void> {
        const presentations = await this.presentations(information);
        if (!this.colors.includes(information)) {
            return;
        }
        const { pick, project } = this.language;
        const rows = presentations.map((presentation, index) => ({ id: String(index), label: presentation.label, detail: '' }));
        pick.open({
            anchor: information.range.start,
            title: project.i18n.t('editor:language.colors.title'),
            groups: [
                { title: null, rows },
                { title: null, rows: [{ id: OTHER_COLOR, label: project.i18n.t('editor:language.colors.other'), detail: '' }] }
            ],
            accept: (id) => {
                if (id === OTHER_COLOR) {
                    this.choose(information, presentations);
                } else {
                    this.apply(presentations[Number(id)]!, information);
                }
            }
        });
    }

    /* The platform's color picker; the new color is written the way the old one was when the server offers that. */
    private choose(information: ColorInformation, before: readonly ColorPresentation[]): void {
        if (typeof document === 'undefined') {
            return;
        }
        const written = this.language.editor.textInRange(information.range);
        const form = Math.max(
            0,
            before.findIndex((presentation) => presentation.label === written)
        );
        const input = document.createElement('input');
        input.type = 'color';
        input.value = hexOf(information.color);
        input.addEventListener(
            'change',
            () => {
                const color = colorOfHex(input.value);
                if (color === null) {
                    return;
                }
                void this.presentations(information, { ...color, alpha: information.color.alpha }).then((presentations) => {
                    const presentation = presentations[form] ?? presentations[0];
                    if (presentation !== undefined) {
                        this.apply(presentation, information);
                    }
                });
            },
            { once: true }
        );
        input.click();
    }
}
