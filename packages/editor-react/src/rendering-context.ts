import { createContext, useContext } from 'react';

export interface EditorRendering {
    readonly theme: string;
    highlight?(code: string, language: string, theme: string): Promise<string>;
}

export const RenderingContext = createContext<EditorRendering>({ theme: 'light' });

export function useEditorRendering(): EditorRendering {
    return useContext(RenderingContext);
}
