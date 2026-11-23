import type { ModelInfo, ModelOptionDescriptor } from '@adecore/agent-contracts';
import { CLAUDE_EFFORT_LEVELS, type ClaudeEffortCapSource, type ClaudeEffortLevel } from '../backends/limits-probe.ts';

const FAMILY_ALIASES: ReadonlySet<string> = new Set(['opus', 'sonnet', 'haiku', 'fable']);
const LONG_CONTEXT_SUFFIX = '[1m]';

function rankOf(level: string): number {
    return (CLAUDE_EFFORT_LEVELS as readonly string[]).indexOf(level);
}

function lowest(current: ClaudeEffortLevel | null, level: ClaudeEffortLevel): ClaudeEffortLevel {
    return current === null || rankOf(level) < rankOf(current) ? level : current;
}

/*
 * The model a `modelSettings` key caps, read as Claude Code reads it: only a family alias (with or without `[1m]`)
 * resolves as an alias, and any other key names the longest model id it contains, so a dated or Bedrock id matches.
 */
function modelOfKey(key: string, slugs: readonly string[], resolveAlias: (alias: string) => string | null): string | null {
    const lowered = key.trim().toLowerCase();
    const unsuffixed = lowered.endsWith(LONG_CONTEXT_SUFFIX) ? lowered.slice(0, -LONG_CONTEXT_SUFFIX.length) : lowered;

    if (FAMILY_ALIASES.has(unsuffixed)) {
        return resolveAlias(unsuffixed);
    }

    let match: string | null = null;

    for (const slug of slugs) {
        if (lowered.includes(slug) && slug.length > (match?.length ?? 0)) {
            match = slug;
        }
    }

    return match;
}

function capped(descriptor: ModelOptionDescriptor, cap: ClaudeEffortLevel): ModelOptionDescriptor {
    if (descriptor.id !== 'effort' || descriptor.type !== 'select') {
        return descriptor;
    }

    // The CLI clamps to the model's highest level at or under the cap, which a model without the capped level lacks.
    const ceiling = descriptor.choices
        .filter((choice) => rankOf(choice.id) !== -1 && rankOf(choice.id) <= rankOf(cap))
        .reduce<{ id: string; label: string } | null>((best, choice) => (best === null || rankOf(choice.id) > rankOf(best.id) ? choice : best), null);

    if (ceiling === null) {
        return descriptor;
    }

    return {
        ...descriptor,
        choices: descriptor.choices.map((choice) =>
            rankOf(choice.id) > rankOf(ceiling.id) ? { ...choice, label: `${choice.label} (capped to ${ceiling.label})` } : choice
        )
    };
}

/*
 * Relabels the efforts above Claude Code's `maxEffortLevel`, which the CLI clamps, as "Max (capped to High)". They
 * stay in the list with their id, so a stored pick stays valid. A cap per model replaces the top-level cap of its own
 * layer, `max` is no cap, and across layers the lowest wins. An effort the CLI has no level for (ultrathink) is left alone.
 */
export function capEffortChoices(
    models: readonly ModelInfo[],
    sources: readonly ClaudeEffortCapSource[],
    resolveAlias: (alias: string) => string | null
): ModelInfo[] {
    if (sources.length === 0) {
        return [...models];
    }

    const slugs = models.map((model) => model.slug);

    const perModel = sources.map((source) => {
        const levels = new Map<string, ClaudeEffortLevel>();

        for (const [key, level] of Object.entries(source.models ?? {})) {
            const slug = modelOfKey(key, slugs, resolveAlias);

            if (slug !== null) {
                levels.set(slug, lowest(levels.get(slug) ?? null, level));
            }
        }

        return { top: source.maxEffortLevel, levels };
    });

    const capOf = (slug: string): ClaudeEffortLevel | null => {
        let cap: ClaudeEffortLevel | null = null;

        for (const source of perModel) {
            const level = source.levels.get(slug) ?? source.top;

            if (level !== undefined && level !== 'max') {
                cap = lowest(cap, level);
            }
        }

        return cap;
    };

    return models.map((model) => {
        const cap = capOf(model.slug);

        return cap === null ? model : { ...model, options: model.options.map((descriptor) => capped(descriptor, cap)) };
    });
}
