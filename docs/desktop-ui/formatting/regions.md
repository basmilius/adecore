# Regions

The regions a person can pick for the notation, beside the one their language comes with and the one the operating system was set to. The list is short on purpose: it is for a computer whose region reads nothing like the person in front of it, not a country picker.

```ts
import { FORMAT_LANGUAGE, FORMAT_REGION_CHOICES, FORMAT_REGIONS, FORMAT_SYSTEM, formatRegionFrom, regionName } from '@basmilius/desktop-ui/format';
```

<Demo src="formatting/regions" />

## The choices

`FORMAT_REGIONS` holds the tags on offer: `nl-NL`, `en-US`, `en-GB`, `de-DE`, `fr-FR`, `es-ES`, `sv-SE` and `ja-JP`. `FORMAT_REGION_CHOICES` puts two more in front of them, which is the list a settings select offers:

`FORMAT_LANGUAGE` follows the language. It uses the operating system's region when that already speaks the language, so Dutch in Belgium keeps writing dates the Belgian way, and otherwise the country the language is most spoken in: `en-US` for English, `nl-NL` for Dutch.

`FORMAT_SYSTEM` follows the operating system, through `systemLocale()`. A desktop shell that reads the system's region should hand it over as `systemLocale` in the [source](/desktop-ui/formatting/#the-source): inside a shell the browser's own locale is the language of the app bundle, so an English app on a Dutch Mac would write `08:00 AM`.

## Naming a region

`regionName(region, language)` names the country of a tag in a language, through `Intl.DisplayNames`: `nl-NL` in English is "Netherlands", in Dutch "Nederland". No translation file carries a list of countries.

## Reading a stored value

`formatRegionFrom(stored)` answers the stored region if it is one of the choices, and `FORMAT_LANGUAGE` for anything else, such as a region an older or newer version of your app wrote. Run a stored setting through it before you hand it to the source.

## The time zone

`localTimeZone()` answers the IANA time zone of this computer, such as `Europe/Amsterdam`, or `null` when the runtime does not say.
