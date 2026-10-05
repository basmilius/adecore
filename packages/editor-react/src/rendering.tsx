import type { ReactNode } from 'react';
import { RenderingContext, type EditorRendering } from './rendering-context.ts';

export function EditorRenderingProvider({ value, children }: { value: EditorRendering; children: ReactNode }) {
    return <RenderingContext value={value}>{children}</RenderingContext>;
}
