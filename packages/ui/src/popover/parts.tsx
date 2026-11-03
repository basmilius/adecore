import { useState, type ComponentProps } from 'react';
import { Popover as BasePopover } from '@base-ui/react/popover';
import { PreviewCard as BasePreviewCard } from '@base-ui/react/preview-card';
import { withClass } from '../class-name.ts';
import { mergeRefs } from '../merge-refs.ts';
import { splitPlacement, type PlacementKey } from '../placement.ts';
import { renderPositioner } from '../popup-layer.ts';
import { useOverlayScrollbars } from '../useOverlayScrollbars.tsx';

/* `picker` is a card whose content runs to its edges, `plain` leaves the surface to the caller. */
const POPUP_VARIANT = {
    menu: 'menu-popup',
    picker: 'picker-popup',
    plain: ''
} as const;

export type PopupVariant = keyof typeof POPUP_VARIANT;

type Placement = Pick<ComponentProps<typeof BasePopover.Positioner>, PlacementKey>;

export const PopoverRoot = BasePopover.Root;

export const PopoverTrigger = BasePopover.Trigger;

export const PopoverClose = BasePopover.Close;

export const PopoverTitle = BasePopover.Title;

export const PopoverDescription = BasePopover.Description;

export type PopoverPopupProps = ComponentProps<typeof BasePopover.Popup> &
    Placement & {
        variant?: PopupVariant;
    };

export function PopoverPopup({ variant = 'menu', side = 'bottom', align = 'start', sideOffset = 8, className, ref, ...props }: PopoverPopupProps) {
    const [placement, popupProps] = splitPlacement(props);
    const [popup, setPopup] = useState<HTMLDivElement | null>(null);
    const scrollbars = useOverlayScrollbars(popup);

    return (
        <BasePopover.Portal>
            <BasePopover.Positioner className="popup-positioner" render={renderPositioner} {...placement} side={side} align={align} sideOffset={sideOffset}>
                <BasePopover.Popup ref={mergeRefs(setPopup, ref)} className={withClass(POPUP_VARIANT[variant], className)} {...popupProps} />
                {scrollbars}
            </BasePopover.Positioner>
        </BasePopover.Portal>
    );
}

export const PreviewCardRoot = BasePreviewCard.Root;

export const PreviewCardTrigger = BasePreviewCard.Trigger;

export type PreviewCardPopupProps = ComponentProps<typeof BasePreviewCard.Popup> &
    Placement & {
        variant?: PopupVariant;
    };

/* A card that opens while the pointer rests on its trigger, drawn like a popover. */
export function PreviewCardPopup({ variant = 'menu', side = 'bottom', align = 'start', sideOffset = 8, className, ref, ...props }: PreviewCardPopupProps) {
    const [placement, popupProps] = splitPlacement(props);
    const [popup, setPopup] = useState<HTMLDivElement | null>(null);
    const scrollbars = useOverlayScrollbars(popup);

    return (
        <BasePreviewCard.Portal>
            <BasePreviewCard.Positioner className="z-(--z-popup)" {...placement} side={side} align={align} sideOffset={sideOffset}>
                <BasePreviewCard.Popup ref={mergeRefs(setPopup, ref)} className={withClass(POPUP_VARIANT[variant], className)} {...popupProps} />
                {scrollbars}
            </BasePreviewCard.Positioner>
        </BasePreviewCard.Portal>
    );
}
