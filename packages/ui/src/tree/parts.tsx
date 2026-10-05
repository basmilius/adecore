import type { MouseEvent, KeyboardEvent, PointerEvent } from 'react';
import clsx from 'clsx';
import { useRender } from '@base-ui-components/react/use-render';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Checkbox as UICheckbox, type CheckboxProps } from '../Checkbox.tsx';
import { Icon } from '../Icon.tsx';
import { treeRowStyle } from './style.ts';

export type TreeRootProps = useRender.ComponentProps<'div'>;

export function TreeRoot({ render, className, ref, children, ...props }: TreeRootProps) {
    return useRender({
        render,
        ref,
        defaultTagName: 'div',
        props: {
            role: 'tree',
            ...props,
            className: clsx('adecore-tree', className),
            children: (
                <>
                    <style>{treeRowStyle('.adecore-tree-row')}</style>
                    {children}
                </>
            )
        }
    });
}

export type TreeRowProps = useRender.ComponentProps<'div'> & {
    level?: number;
    selected?: boolean;
    joinedStart?: boolean;
    joinedEnd?: boolean;
    interactive?: boolean;
};

export function TreeRow({
    level = 1,
    selected = false,
    joinedStart = false,
    joinedEnd = false,
    interactive = true,
    render,
    className,
    ref,
    style,
    children,
    ...props
}: TreeRowProps) {
    return useRender({
        render,
        ref,
        defaultTagName: 'div',
        props: {
            role: 'treeitem',
            'aria-level': level,
            'aria-selected': selected,
            ...props,
            'data-selected': selected,
            'data-joined-start': joinedStart,
            'data-joined-end': joinedEnd,
            'data-interactive': interactive,
            className: clsx('adecore-tree-row', className),
            style: { paddingInlineStart: 4 + (Math.max(1, level) - 1) * 16, ...style },
            children: (
                <>
                    {Array.from({ length: Math.max(0, level - 1) }, (_, index) => (
                        <span key={index} aria-hidden className="adecore-tree-guide" style={{ insetInlineStart: 11 + index * 16 }} />
                    ))}
                    {children}
                </>
            )
        }
    });
}

export type TreeChevronSlotProps = useRender.ComponentProps<'span'>;

export function TreeChevronSlot({ render, className, ref, ...props }: TreeChevronSlotProps) {
    return useRender({
        render,
        ref,
        defaultTagName: 'span',
        props: { 'aria-hidden': true, ...props, className: clsx('adecore-tree-chevron-slot', className) }
    });
}

export type TreeChevronProps = useRender.ComponentProps<'button'> & {
    expanded: boolean;
    onExpandedChange?(expanded: boolean): void;
};

export function TreeChevron({ expanded, onExpandedChange, render, className, ref, onClick, onDoubleClick, ...props }: TreeChevronProps) {
    const { t } = useTranslation('ui');
    return useRender({
        render,
        ref,
        defaultTagName: 'button',
        props: {
            type: 'button',
            tabIndex: -1,
            'aria-label': t(expanded ? 'tree.collapse' : 'tree.expand'),
            ...props,
            className: clsx('adecore-tree-chevron-slot', className),
            onClick: (event: MouseEvent<HTMLButtonElement>) => {
                event.stopPropagation();
                onClick?.(event);
                if (!event.defaultPrevented) {
                    onExpandedChange?.(!expanded);
                }
            },
            onDoubleClick: (event: MouseEvent<HTMLButtonElement>) => {
                event.stopPropagation();
                onDoubleClick?.(event);
            },
            children: <Icon icon={ChevronRight} size={12} className={expanded ? 'rotate-90' : undefined} />
        }
    });
}

export type TreeLabelProps = useRender.ComponentProps<'span'>;
export function TreeLabel({ render, className, ref, ...props }: TreeLabelProps) {
    return useRender({ render, ref, defaultTagName: 'span', props: { ...props, className: clsx('adecore-tree-label', className) } });
}

export type TreeDecorationProps = useRender.ComponentProps<'span'>;
export function TreeDecoration({ render, className, ref, ...props }: TreeDecorationProps) {
    return useRender({ render, ref, defaultTagName: 'span', props: { ...props, className: clsx('adecore-tree-decoration', className) } });
}

export type TreeControlProps = useRender.ComponentProps<'span'>;
export function TreeControl({ render, className, ref, onClick, onDoubleClick, onKeyDown, onPointerDown, ...props }: TreeControlProps) {
    return useRender({
        render,
        ref,
        defaultTagName: 'span',
        props: {
            ...props,
            'data-tree-control': true,
            className: clsx('adecore-tree-control', className),
            onClick: (event: MouseEvent<HTMLSpanElement>) => {
                event.stopPropagation();
                onClick?.(event);
            },
            onDoubleClick: (event: MouseEvent<HTMLSpanElement>) => {
                event.stopPropagation();
                onDoubleClick?.(event);
            },
            onKeyDown: (event: KeyboardEvent<HTMLSpanElement>) => {
                event.stopPropagation();
                onKeyDown?.(event);
            },
            onPointerDown: (event: PointerEvent<HTMLSpanElement>) => {
                event.stopPropagation();
                onPointerDown?.(event);
            }
        }
    });
}

export type TreeCheckboxProps = CheckboxProps;
export function TreeCheckbox(props: TreeCheckboxProps) {
    return (
        <TreeControl>
            <UICheckbox {...props} />
        </TreeControl>
    );
}
