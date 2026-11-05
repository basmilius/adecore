import { checkSnippet } from './snippet.ts';
import { BUILT_IN_LIVE_TEMPLATES, BUILT_IN_POSTFIX_TEMPLATES } from './template-builtins.ts';
import type { LiveTemplate, PostfixTemplate, TemplateLanguage, TemplatePlace } from './template-types.ts';

export { BUILT_IN_LIVE_TEMPLATES, BUILT_IN_POSTFIX_TEMPLATES };

const MAX_KEY_LENGTH = 40;
const MAX_BODY_LENGTH = 20_000;
const POSTFIX_LANGUAGES: readonly string[] = ['javascript', 'typescript', 'php'];
const LANGUAGES: readonly string[] = ['javascript', 'typescript', 'php', 'css', 'html', 'xml', 'other'];
const PLACES: readonly string[] = ['code', 'comment', 'string'];

/* Each is on unless false. */
export interface TemplateSettings {
    /* Live templates are rows of the suggestion list. */
    readonly liveInCompletion?: boolean;

    /* Tab after a dot and a key expands a postfix template. */
    readonly postfix?: boolean;

    /* Postfix templates are rows of the suggestion list. */
    readonly postfixInCompletion?: boolean;
}

/* What Save as Live Template hands the host. */
export interface LiveTemplateDraft {
    readonly body: string;
    readonly languages: readonly TemplateLanguage[];
    readonly places: readonly TemplatePlace[];
}

export interface TemplateRegistryOptions {
    /* Whether the built-in templates are part of the registry; true by default. */
    readonly builtins?: boolean;
}

export interface TemplateUpdate {
    readonly live?: readonly LiveTemplate[];
    readonly postfix?: readonly PostfixTemplate[];

    /* Ids of the built-in templates that are off. */
    readonly disabled?: readonly string[];
    readonly settings?: TemplateSettings;
}

/*
 * The templates the editors of a project know: the built-in ones and the ones a host sets. A host that keeps
 * templates feeds them through `set`, and the editors read the registry on every use.
 */
export class TemplateRegistry {
    private readonly builtins: boolean;
    private readonly listeners = new Set<() => void>();
    private own: { live: readonly LiveTemplate[]; postfix: readonly PostfixTemplate[] } = { live: [], postfix: [] };
    private off: ReadonlySet<string> = new Set();
    private current: Required<TemplateSettings> = { liveInCompletion: true, postfix: true, postfixInCompletion: true };
    private liveList: readonly LiveTemplate[];
    private postfixList: readonly PostfixTemplate[];

    constructor(options: TemplateRegistryOptions = {}) {
        this.builtins = options.builtins !== false;
        this.liveList = this.listed(BUILT_IN_LIVE_TEMPLATES, []);
        this.postfixList = this.listed(BUILT_IN_POSTFIX_TEMPLATES, []);
    }

    /* The built-in templates that are not disabled, then the host's. */
    get live(): readonly LiveTemplate[] {
        return this.liveList;
    }

    get postfix(): readonly PostfixTemplate[] {
        return this.postfixList;
    }

    get settings(): Required<TemplateSettings> {
        return this.current;
    }

    /* Replaces what the update names. A template that fails `checkTemplate` is dropped; this never throws. */
    set(update: TemplateUpdate): void {
        this.own = {
            live: update.live === undefined ? this.own.live : update.live.filter((template) => checkTemplate(template, 'live') === null),
            postfix: update.postfix === undefined ? this.own.postfix : update.postfix.filter((template) => checkTemplate(template, 'postfix') === null)
        };
        this.off = update.disabled === undefined ? this.off : new Set(update.disabled);

        if (update.settings !== undefined) {
            this.current = {
                liveInCompletion: update.settings.liveInCompletion !== false,
                postfix: update.settings.postfix !== false,
                postfixInCompletion: update.settings.postfixInCompletion !== false
            };
        }

        this.liveList = this.listed(BUILT_IN_LIVE_TEMPLATES, this.own.live);
        this.postfixList = this.listed(BUILT_IN_POSTFIX_TEMPLATES, this.own.postfix);

        for (const listener of [...this.listeners]) {
            listener();
        }
    }

    /* Calls `listener` after every `set`. Returns the function that stops it. */
    onChange(listener: () => void): () => void {
        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
    }

    private listed<T extends { readonly id: string }>(builtins: readonly T[], own: readonly T[]): readonly T[] {
        return [...(this.builtins ? builtins.filter((template) => !this.off.has(template.id)) : []), ...own];
    }
}

/*
 * Why a template cannot be used, in English for a host to show, or null. `kind` says which rules apply; without it a
 * template with an `expression` or an `example` counts as a postfix one.
 */
export function checkTemplate(template: LiveTemplate | PostfixTemplate, kind?: 'live' | 'postfix'): string | null {
    const postfix = kind === undefined ? 'expression' in template || 'example' in template : kind === 'postfix';

    if (template.id === '') {
        return 'The template has no id.';
    }

    if (template.key === '' || template.key.length > MAX_KEY_LENGTH) {
        return `The key is one to ${MAX_KEY_LENGTH} characters.`;
    }

    if (postfix ? !/^[\p{L}\p{N}_$]+$/u.test(template.key) : /\s/.test(template.key)) {
        return postfix ? 'The key holds letters, digits, underscores and dollar signs only.' : 'The key holds no whitespace.';
    }

    if (template.body.trim() === '') {
        return 'The text is empty.';
    }

    if (template.body.length > MAX_BODY_LENGTH) {
        return `The text is longer than ${MAX_BODY_LENGTH} characters.`;
    }

    if (template.languages.length === 0 || template.languages.some((language) => !(postfix ? POSTFIX_LANGUAGES : LANGUAGES).includes(language))) {
        return 'The languages are empty or not known.';
    }

    if (!postfix && (template as LiveTemplate).places?.some((place) => !PLACES.includes(place)) === true) {
        return 'The places are not known.';
    }

    return checkSnippet(template.body);
}
