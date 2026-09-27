import type { Ref } from 'react';
import clsx from 'clsx';
import { Ellipsis } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ColorSwatch } from './ColorSwatch.tsx';
import { Icon } from './Icon.tsx';
import { MenuPopup, MenuRadioGroup, MenuRadioItem, MenuRoot, MenuTrigger } from './menu/parts.tsx';
import { Tooltip } from './Tooltip.tsx';

export interface AccentSwatchesProps<Id extends string> {
    value: string | undefined;
    onValueChange(id: Id): void;
    label: string;
    /* Every color on offer, in the order of the list behind the featured ones. */
    accents: readonly { id: Id; color: string }[];
    /* The few drawn in the open, in the order they stand. */
    featured: readonly Id[];
    labelOf(id: Id): string;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

/*
 * An accent, a few colors at a time. A palette is more than a settings row can carry, so the list
 * behind them holds all of them, the featured ones included; the trigger wears the chosen color
 * itself whenever that color is not one of the few. A value that is no accent at all picks nothing.
 */
export function AccentSwatches<Id extends string>({ value, onValueChange, label, accents, featured, labelOf, className, ref }: AccentSwatchesProps<Id>) {
    const { t } = useTranslation('ui');
    const isFeatured = (id: string): boolean => featured.some((entry) => entry === id);
    const colorOf = (id: string): string | undefined => accents.find((entry) => entry.id === id)?.color;
    const shown = accents.filter((entry) => isFeatured(entry.id)).sort((a, b) => featured.indexOf(a.id) - featured.indexOf(b.id));
    const hidden = value !== undefined && !isFeatured(value) && colorOf(value) !== undefined ? value : null;
    return (
        <div ref={ref} className={clsx('flex items-center gap-2', className)} role="radiogroup" aria-label={label}>
            {shown.map((entry) => (
                <Tooltip key={entry.id} label={labelOf(entry.id)}>
                    <ColorSwatch
                        role="radio"
                        aria-checked={value === entry.id}
                        aria-label={labelOf(entry.id)}
                        color={entry.color}
                        picked={value === entry.id}
                        onClick={() => onValueChange(entry.id)}
                    />
                </Tooltip>
            ))}
            <MenuRoot>
                <Tooltip label={t('accent.more')}>
                    <ColorSwatch
                        render={<MenuTrigger />}
                        aria-label={t('accent.more')}
                        color={hidden === null ? undefined : colorOf(hidden)}
                        picked={hidden !== null}
                    >
                        {/* Undefined leaves the tick of the picked color; otherwise this says there is more behind the swatch. */}
                        {hidden === null ? <Icon icon={Ellipsis} size={12} /> : undefined}
                    </ColorSwatch>
                </Tooltip>
                <MenuPopup align="end" className="max-h-96 overflow-y-auto">
                    <MenuRadioGroup value={value ?? null} onValueChange={(id: Id) => onValueChange(id)}>
                        {accents.map((entry) => (
                            <MenuRadioItem key={entry.id} value={entry.id}>
                                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: entry.color }} aria-hidden />
                                <span className="grow">{labelOf(entry.id)}</span>
                            </MenuRadioItem>
                        ))}
                    </MenuRadioGroup>
                </MenuPopup>
            </MenuRoot>
        </div>
    );
}
