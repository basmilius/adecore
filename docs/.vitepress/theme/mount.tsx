import type { ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { DemoFrame } from './DemoFrame.tsx';

// `shared` holds what the demos import, such as the app's i18next and settings; none of it is a demo.
const DEMOS = import.meta.glob<{ default: ComponentType }>(['../../demos/**/*.tsx', '!../../demos/shared/**']);

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
