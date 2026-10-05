import type { ReactNode } from 'react';
import type { EditorMarkColor, EditorRect } from '@adecore/editor';
import { AnchoredPopup } from './AnchoredPopup.tsx';

export interface AttributionCardProps {
    rect: EditorRect;
    title: string;
    subtitle?: string;
    metadata?: ReactNode;
    prompt?: string;
    color?: EditorMarkColor;
    icon?: ReactNode;
    actions?: ReactNode;
    onHold?(inside: boolean): void;
}

export function AttributionCard({ rect, title, subtitle, metadata, prompt, color, icon, actions, onHold }: AttributionCardProps) {
    return (
        <AnchoredPopup rect={rect} className="flex w-105 flex-col text-xs" onPointerEnter={() => onHold?.(true)} onPointerLeave={() => onHold?.(false)}>
            <div className="flex flex-col gap-2 px-3 pt-3 pb-2.5">
                <div className="flex items-center gap-2">
                    <span className="flex shrink-0 items-center" style={{ color: color?.startsWith('--') ? `var(${color})` : color }}>
                        {icon ?? <span className="size-2 rounded-full bg-current" />}
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-text">{title}</span>
                    {subtitle !== undefined && <span className="min-w-0 truncate text-sm text-text-muted">{subtitle}</span>}
                </div>
                {metadata !== undefined && <div className="text-text-muted">{metadata}</div>}
                {prompt !== undefined && prompt !== '' && (
                    <q className="line-clamp-4 rounded-md bg-surface-hover px-2.5 py-2 text-sm leading-4.5 text-text select-text">{prompt}</q>
                )}
            </div>
            {actions !== undefined && <div className="flex gap-1 border-t border-border px-1.5 py-1.25">{actions}</div>}
        </AnchoredPopup>
    );
}
