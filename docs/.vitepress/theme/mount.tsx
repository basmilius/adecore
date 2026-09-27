import { createRoot } from 'react-dom/client';
import type { ComponentType } from 'react';
import { DemoFrame } from './DemoFrame.tsx';

// `shared` holds what the demos import, such as the app's i18next and settings; none of it is a demo.
const DEMOS = import.meta.glob<{ default: ComponentType }>(['../../demos/**/*.tsx', '!../../demos/shared/**']);

/* Draws one demo into the island a page holds for it, and answers how to take it down again. */
export async function mountDemo(src: string, host: HTMLElement): Promise<() => void> {
    const load = DEMOS[`../../demos/${src}.tsx`];
    if (load === undefined) {
        throw new Error(`There is no demo at docs/demos/${src}.tsx.`);
    }
    const { default: Demo } = await load();
    const root = createRoot(host);
    root.render(
        <DemoFrame src={src}>
            <Demo />
        </DemoFrame>
    );
    return () => root.unmount();
}
