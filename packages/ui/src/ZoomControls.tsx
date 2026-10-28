import type { Ref } from 'react';
import clsx from 'clsx';
import { Maximize, Minus, Plus, Scan, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ButtonGroup } from './ButtonGroup.tsx';
import { Icon } from './Icon.tsx';
import { IconButton, type IconButtonSize } from './IconButton.tsx';
import { Kbd } from './Kbd.tsx';
import { MenuItem, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuRoot, MenuSeparator, MenuTrigger } from './menu/parts.tsx';
import type { Shortcut } from './shortcut.ts';
import { Tooltip } from './Tooltip.tsx';
import { activeZoomPreset, steppedZoom, ZOOM_PRESETS } from './zoom.ts';

export interface ZoomSelection {
    label: string;
    shortcut?: Shortcut;

    /* Nothing is selected, so the row is there but says so rather than doing nothing. */
    enabled: boolean;

    onZoom(): void;
}

/* The words, when the app wants its own; each falls back to the library's. */
export interface ZoomLabels {
    out?: string;
    in?: string;
    presets?: string;
    fit?: string;
    fitEverything?: string;
}

export interface ZoomControlsProps {
    /* 1 is 100%. */
    zoom: number;

    onZoomChange(zoom: number): void;
    onFitAll(): void;
    presets?: readonly number[];
    labels?: ZoomLabels;
    shortcuts?: { zoomReset?: Shortcut; fitAll?: Shortcut };

    /* Left out by a surface with nothing to select. */
    selection?: ZoomSelection;

    /* `md` beside the controls of a dock, `sm` beside the small buttons of a toolbar. */
    size?: Extract<IconButtonSize, 'md' | 'sm'>;

    /* Where the presets open: above a dock at the bottom, below a toolbar at the top. */
    side?: 'top' | 'bottom';

    className?: string;
    ref?: Ref<HTMLDivElement>;
}

/* The percentage between the buttons, at the height and radius of the buttons beside it. */
const TRIGGER_SIZE = { md: 'h-8 min-w-14 rounded-lg', sm: 'h-7 min-w-12 rounded-md' } as const;

function MenuIcon({ icon }: { icon: LucideIcon }) {
    return (
        <span className="grid h-4 w-4 place-items-center">
            <Icon icon={icon} size={14} />
        </span>
    );
}

export function ZoomControls({
    zoom,
    onZoomChange,
    onFitAll,
    presets = ZOOM_PRESETS,
    labels = {},
    shortcuts = {},
    selection,
    size = 'md',
    side = 'top',
    className,
    ref
}: ZoomControlsProps) {
    const { t } = useTranslation('ui');
    const preset = activeZoomPreset(zoom, presets);

    return (
        <ButtonGroup ref={ref} className={className}>
            <IconButton icon={Minus} size={size} label={labels.out ?? t('zoom.out')} onClick={() => onZoomChange(steppedZoom(zoom, -10))} />
            <MenuRoot>
                <Tooltip label={labels.presets ?? t('zoom.presets')}>
                    <MenuTrigger
                        className={clsx(
                            TRIGGER_SIZE[size],
                            'px-1 text-xs text-text-muted tabular-nums hover:bg-surface-hover hover:text-text data-[popup-open]:bg-surface-active data-[popup-open]:text-text'
                        )}
                    >
                        {Math.round(zoom * 100)}%
                    </MenuTrigger>
                </Tooltip>
                <MenuPopup side={side} sideOffset={10} align="center" className="min-w-44">
                    <MenuRadioGroup value={preset} onValueChange={(value: number) => onZoomChange(value / 100)}>
                        {presets.map((percent) => (
                            <MenuRadioItem key={percent} value={percent}>
                                <span className="tabular-nums">{percent}%</span>
                                {percent === 100 && shortcuts.zoomReset && <Kbd shortcut={shortcuts.zoomReset} />}
                            </MenuRadioItem>
                        ))}
                    </MenuRadioGroup>
                    <MenuSeparator />
                    <MenuItem onClick={onFitAll}>
                        <MenuIcon icon={Maximize} />
                        {labels.fit ?? t('zoom.fit')} {shortcuts.fitAll && <Kbd shortcut={shortcuts.fitAll} />}
                    </MenuItem>
                    {selection && (
                        <MenuItem disabled={!selection.enabled} onClick={selection.onZoom}>
                            <MenuIcon icon={Scan} />
                            {selection.label} {selection.shortcut && <Kbd shortcut={selection.shortcut} />}
                        </MenuItem>
                    )}
                </MenuPopup>
            </MenuRoot>
            <IconButton icon={Plus} size={size} label={labels.in ?? t('zoom.in')} onClick={() => onZoomChange(steppedZoom(zoom, 10))} />
            <IconButton icon={Maximize} size={size} label={labels.fitEverything ?? t('zoom.fitEverything')} kbd={shortcuts.fitAll} onClick={onFitAll} />
        </ButtonGroup>
    );
}
