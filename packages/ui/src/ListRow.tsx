import { useRender } from '@base-ui/react/use-render';
import clsx from 'clsx';

const VARIANT = {
    /* A row of a list that reads as a table and fills the width of its panel: commits, processes,
       branches. Square, so the rows stack into one block. It carries no padding; the caller pads 12px
       beside text and 4px beside a button. */
    flat: 'flex h-7 items-center',
    /* A row of a list a person finds their way through: a sidebar, devices, recent files. Inset from
       the edge and rounded, so each row reads as a place of its own. */
    inset: 'flex h-8 items-center rounded-md px-2',
    /* A row of several lines, such as a message with its sender, subject and preview. */
    stacked: 'flex flex-col items-stretch gap-0.5 rounded-lg px-2.5 py-2 text-left'
} as const;

/* The start padding of each variant, which an indent adds its steps to. */
const START = { flat: 0, inset: 8, stacked: 10 } as const;

const INDENT_STEP = 24;

export type ListRowProps = useRender.ComponentProps<'div'> & {
    variant: keyof typeof VARIANT;

    /* Draws the selected ground and marks the row current, or selected when its `role` is `option`. Set to `false`, the row draws a hover. */
    selected?: boolean;

    /* Steps of 24 pixels added to the start padding, for a row nested under another. */
    indent?: number;
};

/* The height and the shape of one row of a list. What it does (a button, a link, a menu trigger) comes from `render`. */
export function ListRow({ variant, selected, indent = 0, render, className, style, ref, ...props }: ListRowProps) {
    const option = props.role === 'option';
    const state = selected === undefined ? {} : option ? { 'aria-selected': selected } : { 'aria-current': selected ? ('true' as const) : undefined };

    return useRender({
        render,
        ref,
        defaultTagName: 'div',
        props: {
            ...state,
            ...props,
            style: indent > 0 ? { paddingInlineStart: START[variant] + indent * INDENT_STEP, ...style } : style,
            className: clsx(VARIANT[variant], selected === true && 'bg-surface-active', selected === false && 'hover:bg-surface-hover', className)
        }
    });
}
