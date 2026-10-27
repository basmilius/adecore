// The package ships `dist/index.d.ts`, but its `exports` point TypeScript at none, so the part used here is declared again.
declare module 'emmet' {
    export interface MarkupAbbreviationNode {
        name?: string;
        children: MarkupAbbreviationNode[];
    }

    export interface MarkupAbbreviation {
        type: 'Abbreviation';
        children: MarkupAbbreviationNode[];
    }

    export interface ExtractedAbbreviation {
        abbreviation: string;
        location: number;
        start: number;
        end: number;
    }

    export interface ExtractOptions {
        lookAhead: boolean;
        type: 'markup' | 'stylesheet';
        prefix: string;
    }

    export interface UserConfig {
        syntax?: string;
        text?: string | string[];
        options?: {
            'output.field'?: (index: number, placeholder: string, offset: number, line: number, column: number) => string;
            'output.text'?: (text: string, offset: number, line: number, column: number) => string;
            'output.indent'?: string;
        };
    }

    export interface Config extends UserConfig {
        type: 'markup' | 'stylesheet';
    }

    export function extract(line: string, pos?: number, options?: Partial<ExtractOptions>): ExtractedAbbreviation | undefined;
    export function markupAbbreviation(abbreviation: string, options?: { text?: string | string[] }): MarkupAbbreviation;
    export function markup(abbreviation: string | MarkupAbbreviation, config: Config): string;
    export function resolveConfig(config?: UserConfig): Config;
}
