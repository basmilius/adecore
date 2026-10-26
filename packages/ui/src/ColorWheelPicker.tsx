import { useEffect, useId, useRef, useState, type KeyboardEvent, type Ref } from 'react';
import { ChevronDown } from 'lucide-react';
import { ColorSwatch } from './ColorSwatch.tsx';
import { Icon } from './Icon.tsx';
import { PopoverPopup, PopoverRoot, PopoverTrigger } from './popover/parts.tsx';
import { triggerClassName } from './select-shared.ts';

const SWATCH_SIZE = 24;

/* The outer ring stands this far from the middle, further when its swatches would not keep a gap between them otherwise. */
const MIN_RADIUS = 97;

const MIN_GAP = 8;

/* Room past the outer ring for the ring a picked swatch wears. */
const EDGE = 7;

export interface ColorWheelPickerProps<Id extends string> {
    value: Id;
    onValueChange(id: Id): void;

    /* The one under the pointer or the focus while the wheel is open; null once none is looked at. */
    onPreviewChange?(id: Id | null): void;

    /* The accessible name; the row the picker stands in usually carries the visible one. */
    label: string;

    /* From the outside in, each ring in its own order from the top. */
    rings: readonly (readonly Id[])[];

    center?: Id;

    /* Any CSS background, a gradient too. */
    colorOf(id: Id): string;

    labelOf(id: Id): string;
    disabled?: boolean;
    align?: 'start' | 'end';
    className?: string;
    ref?: Ref<HTMLButtonElement>;
}

interface Spot<Id> {
    id: Id;
    left: number;
    top: number;
}

/* Top left corners in whole pixels, the rings evenly apart from the outer one to the middle. */
function layout<Id>(rings: readonly (readonly Id[])[], center: Id | undefined): { size: number; spots: Spot<Id>[] } {
    const outer = rings[0]?.length ?? 0;
    const radius = Math.max(MIN_RADIUS, outer > 1 ? Math.ceil((SWATCH_SIZE + MIN_GAP) / (2 * Math.sin(Math.PI / outer))) : 0);
    const size = 2 * (radius + SWATCH_SIZE / 2 + EDGE);
    const middle = (size - SWATCH_SIZE) / 2;

    const spot = (id: Id, turn: number, distance: number): Spot<Id> => {
        const angle = turn * 2 * Math.PI - Math.PI / 2;

        return { id, left: Math.round(middle + distance * Math.cos(angle)), top: Math.round(middle + distance * Math.sin(angle)) };
    };

    const spots = rings.flatMap((ring, depth) => ring.map((id, i) => spot(id, i / ring.length, (radius * (rings.length - depth)) / rings.length)));

    return { size, spots: center === undefined ? spots : [...spots, spot(center, 0, 0)] };
}

const STEPS: Record<string, (index: number, count: number) => number> = {
    ArrowRight: (index, count) => (index + 1) % count,
    ArrowDown: (index, count) => (index + 1) % count,
    ArrowLeft: (index, count) => (index - 1 + count) % count,
    ArrowUp: (index, count) => (index - 1 + count) % count,
    Home: () => 0,
    End: (_, count) => count - 1
};

/*
 * The looked-at swatch's name stands under the wheel, so a swatch carries no tooltip. Only Enter, Space
 * or a click picks. Every preview ends with null: after a pick, on closing, or on going away while open.
 */
export function ColorWheelPicker<Id extends string>({
    value,
    onValueChange,
    onPreviewChange,
    label,
    rings,
    center,
    colorOf,
    labelOf,
    disabled,
    align = 'start',
    className,
    ref
}: ColorWheelPickerProps<Id>) {
    const labelId = useId();
    const valueId = useId();
    const [open, setOpen] = useState(false);
    const [looking, setLooking] = useState<Id | null>(null);
    const [focused, setFocused] = useState<Id | null>(null);
    const wheel = useRef<HTMLDivElement>(null);
    const { size, spots } = layout(rings, center);
    const tabStop = spots.find((spot) => spot.id === (focused ?? value))?.id ?? spots[0]?.id;
    // Read by the cleanup below, which runs after the state and the props of its render are gone.
    const preview = useRef({ looking: false, onPreviewChange });

    useEffect(() => {
        preview.current.onPreviewChange = onPreviewChange;
    });

    const look = (id: Id | null): void => {
        setLooking(id);
        preview.current.looking = id !== null;
        onPreviewChange?.(id);
    };

    // A picker taken away while a color is previewed gets no close of its popover, so it ends the preview itself.
    useEffect(
        () => () => {
            if (preview.current.looking) {
                preview.current.onPreviewChange?.(null);
            }
        },
        []
    );

    const close = (): void => {
        setOpen(false);
        setFocused(null);
        look(null);
    };

    const step = (event: KeyboardEvent<HTMLDivElement>): void => {
        const next = STEPS[event.key];
        const swatches = [...(wheel.current?.querySelectorAll<HTMLElement>('[role="radio"]') ?? [])];
        const index = swatches.indexOf(event.target as HTMLElement);

        if (next === undefined || index < 0) {
            return;
        }

        event.preventDefault();
        swatches[next(index, swatches.length)]?.focus();
    };

    return (
        <PopoverRoot
            open={open}
            onOpenChange={(next) => {
                if (next) {
                    setOpen(true);
                } else {
                    close();
                }
            }}
        >
            <span id={labelId} hidden>
                {label}
            </span>
            <PopoverTrigger ref={ref} disabled={disabled} aria-labelledby={`${labelId} ${valueId}`} className={triggerClassName('md', 'outlined', className)}>
                <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: colorOf(value) }} aria-hidden />
                <span id={valueId} className="truncate">
                    {labelOf(value)}
                </span>
                <span className="ml-auto flex shrink-0 pl-1">
                    <Icon icon={ChevronDown} size={14} />
                </span>
            </PopoverTrigger>
            {/* The swatch in use takes the focus: the first would otherwise, and a swatch with the focus is previewed, so the caller would show a color nobody asked for. */}
            <PopoverPopup align={align} initialFocus={() => wheel.current?.querySelector<HTMLElement>('[aria-checked="true"]') ?? false}>
                <div className="flex flex-col items-center gap-3 p-3">
                    <div
                        ref={wheel}
                        role="radiogroup"
                        aria-label={label}
                        className="relative"
                        style={{ width: size, height: size }}
                        onPointerLeave={() => look(null)}
                        onKeyDown={step}
                    >
                        {spots.map(({ id, left, top }) => (
                            <ColorSwatch
                                key={id}
                                role="radio"
                                aria-checked={value === id}
                                aria-label={labelOf(id)}
                                tabIndex={id === tabStop ? 0 : -1}
                                color={colorOf(id)}
                                picked={value === id}
                                tick={false}
                                on="popup"
                                className="absolute"
                                style={{ left, top }}
                                onPointerEnter={() => look(id)}
                                onFocus={() => {
                                    setFocused(id);
                                    look(id);
                                }}
                                onClick={() => {
                                    onValueChange(id);
                                    close();
                                }}
                            />
                        ))}
                    </div>
                    <span className="text-xs text-text-muted">{labelOf(looking ?? value)}</span>
                </div>
            </PopoverPopup>
        </PopoverRoot>
    );
}
