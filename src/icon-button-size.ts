export type IconButtonSize = 'md' | 'sm' | 'xs' | '2xs';

/* The size decides the square and the radius (`.icon-btn` in `theme.css`) and the icon inside: 16 in 32, 14 in 28, 12 below. */
export const ICON_BUTTON_CLASS: Record<IconButtonSize, string | undefined> = { md: undefined, sm: 'icon-btn-sm', xs: 'icon-btn-xs', '2xs': 'icon-btn-2xs' };

export const ICON_BUTTON_ICON_SIZE: Record<IconButtonSize, number> = { md: 16, sm: 14, xs: 12, '2xs': 12 };
