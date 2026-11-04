import { ErrorBoundary, UIProvider } from '@adecore/ui';
import type { ReactNode } from 'react';
import { i18n } from '../../demos/shared/i18n.ts';
import { formatSource } from '../../demos/shared/preferences.ts';

/* The words, the format source and an error boundary, which an app puts around the library once and the docs around every demo. */
export function DemoFrame({ src, children }: { src: string; children: ReactNode }) {
    return (
        <UIProvider i18n={i18n} formatSource={formatSource}>
            <ErrorBoundary label={`The demo ${src} failed to render`} className="relative">
                {children}
            </ErrorBoundary>
        </UIProvider>
    );
}
