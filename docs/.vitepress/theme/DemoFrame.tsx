import type { ReactNode } from 'react';
import { ErrorBoundary, UIProvider } from '@basmilius/desktop-ui';
import { i18n } from '../../demos/shared/i18n.ts';
import { formatSource } from '../../demos/shared/preferences.ts';

/* What every app puts around the library once, here around every demo: the words, the format source and a boundary. */
export function DemoFrame({ src, children }: { src: string; children: ReactNode }) {
    return (
        <UIProvider i18n={i18n} formatSource={formatSource}>
            <ErrorBoundary label={`The demo ${src} failed to render`} className="relative">
                {children}
            </ErrorBoundary>
        </UIProvider>
    );
}
