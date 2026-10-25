import { FileText, Frame, Globe, MessageSquare, PenTool, Smartphone, StickyNote, Terminal, Type, Workflow, type LucideIcon } from 'lucide-react';
import type { ReferableKind } from '../chat-references';

/* The mark of what a `#` points at, in the picker and on its chip. */
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
    file: FileText
};
