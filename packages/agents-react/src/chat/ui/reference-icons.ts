import { createElement, type ComponentType, type ReactNode } from 'react';
import { Database, FileText, Frame, Globe, MessageSquare, PenTool, Smartphone, StickyNote, Terminal, Type, Workflow, type LucideIcon } from 'lucide-react';
import { Icon } from '@adecore/ui';
import type { ReferenceIconProps } from '../../host';
import type { ReferableKind } from '../chat-references';

/* The mark of what a `#` points at, in the picker and on its chip, when the host draws none of its own. */
export const REFERENCE_ICONS: Record<ReferableKind, LucideIcon> = {
    canvas: Frame,
    chat: MessageSquare,
    terminal: Terminal,
    note: StickyNote,
    text: Type,
    drawing: PenTool,
    diagram: Workflow,
    browser: Globe,
    device: Smartphone,
    file: FileText,
    database: Database
};

/* The host's mark of a reference, or the mark of its kind. */
export function referenceGlyph(HostIcon: ComponentType<ReferenceIconProps> | null | undefined, props: ReferenceIconProps): ReactNode {
    if (HostIcon) {
        return createElement(HostIcon, props);
    }

    return createElement(Icon, { icon: REFERENCE_ICONS[props.kind], size: props.size, className: props.className });
}
