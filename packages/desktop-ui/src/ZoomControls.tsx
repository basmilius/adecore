import type { Ref } from 'react';
import { Maximize, Minus, Plus, Scan } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ButtonGroup } from './ButtonGroup.tsx';
import { Icon } from './Icon.tsx';
import { IconButton } from './IconButton.tsx';
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
    /* The percentages in the menu under the readout. */
    presets?: readonly number[];
    labels?: ZoomLabels;
    shortcuts?: { zoomReset?: Shortcut; fitAll?: Shortcut };
    /* Left out by a surface with nothing to select. */
    selection?: ZoomSelection;
    className?: string;
    ref?: Ref<HTMLDivElement>;
}

/* The zoom group of a dock: out, the readout with its presets, in, and fit everything. */
export function ZoomControls({
    zoom,
    onZoomChange,
    onFitAll,
    presets = ZOOM_PRESETS,
    labels = {},
    shortcuts = {},
    selection,
    className,
    ref
}: ZoomControlsProps) {
    const { t } = useTranslation('ui');
    const preset = activeZoomPreset(zoom, presets);

    return (
        <ButtonGroup ref={ref} className={className}>
            <IconButton icon={Minus} label={labels.out ?? t('zoom.out')} onClick={() => onZoomChange(steppedZoom(zoom, -10))} />
            <MenuRoot>
                <Tooltip label={labels.presets ?? t('zoom.presets')}>
                    <MenuTrigger className="h-8 min-w-14 rounded-lg px-1 text-xs text-text-muted tabular-nums hover:bg-surface-hover hover:text-text data-[popup-open]:bg-surface-active data-[popup-open]:text-text">
                        {Math.round(zoom * 100)}%
                    </MenuTrigger>
                </Tooltip>
                <MenuPopup side="top" sideOffset={10} align="center" className="min-w-44">
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
                        <span className="grid h-4 w-4 place-items-center">
                            <Icon icon={Maximize} size={14} />
                        </span>
                        {labels.fit ?? t('zoom.fit')} {shortcuts.fitAll && <Kbd shortcut={shortcuts.fitAll} />}
                    </MenuItem>
                    {selection && (
                        <MenuItem disabled={!selection.enabled} onClick={selection.onZoom}>
                            <span className="grid h-4 w-4 place-items-center">
                                <Icon icon={Scan} size={14} />
                            </span>
                            {selection.label} {selection.shortcut && <Kbd shortcut={selection.shortcut} />}
                        </MenuItem>
                    )}
                </MenuPopup>
            </MenuRoot>
            <IconButton icon={Plus} label={labels.in ?? t('zoom.in')} onClick={() => onZoomChange(steppedZoom(zoom, 10))} />
            <IconButton icon={Maximize} label={labels.fitEverything ?? t('zoom.fitEverything')} kbd={shortcuts.fitAll} onClick={onFitAll} />
        </ButtonGroup>
    );
}
