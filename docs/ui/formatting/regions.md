# Regions

The regions a person can pick for the notation, beside their language's region and the system's. The list is short on purpose: it fixes a mismatched computer and is no country picker.

```ts
import { FORMAT_LANGUAGE, FORMAT_REGION_CHOICES, FORMAT_REGIONS, FORMAT_SYSTEM, formatRegionFrom, regionName } from '@adecore/ui/format';
```

<Demo src="formatting/regions" />

## The choices

`FORMAT_REGIONS` holds the tags: `nl-NL`, `en-US`, `en-GB`, `de-DE`, `fr-FR`, `es-ES`, `sv-SE` and `ja-JP`. `FORMAT_REGION_CHOICES` adds the two below in front, for a settings select.

`FORMAT_LANGUAGE` follows the language. It uses the system region when that matches the language (Dutch in Belgium stays Belgian), and otherwise the language's main country: `en-US` for English, `nl-NL` for Dutch.

`FORMAT_SYSTEM` follows the operating system through `systemLocale()`. A desktop shell should pass the system region as `systemLocale` in the [source](/ui/formatting/#the-source), because the browser locale there is the app bundle's language.

## Naming a region

`regionName(region, language)` names a tag's country in a language through `Intl.DisplayNames`: `nl-NL` is "Netherlands" in English, "Nederland" in Dutch.

## Reading a stored value

`formatRegionFrom(stored)` returns the stored region if it is a choice, and `FORMAT_LANGUAGE` otherwise. Run a stored setting through it before passing it to the source.

## The time zone

`localTimeZone()` returns the IANA time zone, such as `Europe/Amsterdam`, or `null` when unknown.
