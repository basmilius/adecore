export const FORMAT_LANGUAGE = 'language';
export const FORMAT_SYSTEM = 'system';

/*
 * Short on purpose: for a machine whose region reads nothing like the person in front of it, not a
 * country picker. A country names itself through `Intl.DisplayNames`, so no translation file lists them.
 */
export const FORMAT_REGIONS = ['nl-NL', 'en-US', 'en-GB', 'de-DE', 'fr-FR', 'es-ES', 'sv-SE', 'ja-JP'] as const;

export const FORMAT_REGION_CHOICES: readonly string[] = [FORMAT_LANGUAGE, FORMAT_SYSTEM, ...FORMAT_REGIONS];

/* The country of a region tag, named in `language`: `nl-NL` in English is "Netherlands". */
export const regionName = (region: string, language: string): string =>
    new Intl.DisplayNames([language], { type: 'region' }).of(region.slice(region.indexOf('-') + 1)) ?? region;

/* A stored region, or the language's own for anything this version does not offer. */
export const formatRegionFrom = (stored: unknown): string => FORMAT_REGION_CHOICES.find((region) => region === stored) ?? FORMAT_LANGUAGE;
