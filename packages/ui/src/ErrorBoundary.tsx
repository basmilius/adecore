import { Component, type ErrorInfo, type ReactNode } from 'react';
import clsx from 'clsx';
import { RotateCw, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button.tsx';
import { ButtonGroup } from './ButtonGroup.tsx';
import { CopyButton } from './CopyButton.tsx';
import { errorMessageOf, errorReport, shouldReset, type ResetKeys } from './error-boundary.ts';
import { Icon } from './Icon.tsx';

export interface ErrorBoundaryProps {
    /* The first line of the message: "Could not show this view". */
    label: string;
    resetKeys?: ResetKeys;
    /* Drops the icon and the spacing, for a small surface. */
    compact?: boolean;
    /* For the last resort, which has nothing around it to fall back to. */
    reload?: boolean;
    /* By default the message covers the positioned parent. */
    className?: string;
    children: ReactNode;
}

interface ErrorBoundaryState {
    error: unknown;
    failed: boolean;
    componentStack: string | null;
}

const CLEAR: ErrorBoundaryState = { error: null, failed: false, componentStack: null };

interface FallbackProps {
    label: string;
    error: unknown;
    componentStack: string | null;
    compact: boolean;
    reload: boolean;
    className: string;
    onRetry(): void;
}

/* A function component, so the words come from the i18next instance the app renders with. */
function ErrorFallback({ label, error, componentStack, compact, reload, className, onRetry }: FallbackProps) {
    const { t } = useTranslation('ui');
    return (
        <div role="alert" className={clsx('grid place-items-center overflow-auto bg-surface', compact ? 'p-3' : 'p-6', className)}>
            <div className={clsx('flex max-w-[360px] flex-col items-center text-center', compact ? 'gap-1' : 'gap-2')}>
                {!compact && <Icon icon={TriangleAlert} size={20} className="text-status-error" />}
                <p className="text-sm font-medium text-text">{label}</p>
                <p className="line-clamp-4 text-xs break-words text-text-muted">{errorMessageOf(error)}</p>
                <div className={clsx('flex items-center gap-2', compact ? 'mt-1' : 'mt-2')}>
                    <Button variant="secondary" size="sm" onClick={onRetry}>
                        {t('action.retry')}
                    </Button>
                    {reload && (
                        <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
                            <Icon icon={RotateCw} size={14} />
                            {t('action.reload')}
                        </Button>
                    )}
                    <ButtonGroup>
                        <CopyButton text={errorReport(label, error, componentStack)} label={t('action.copyError')} size="sm" />
                    </ButtonGroup>
                </div>
            </div>
        </div>
    );
}

/* Without one React unmounts the whole tree, and whatever lives in it (an embedded page, a running terminal) goes down with it. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    override state: ErrorBoundaryState = CLEAR;

    static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
        return { error, failed: true };
    }

    override componentDidCatch(error: unknown, info: ErrorInfo): void {
        console.error(`${this.props.label}:`, error, info.componentStack);
        this.setState({ componentStack: info.componentStack ?? null });
    }

    override componentDidUpdate(previous: ErrorBoundaryProps): void {
        if (shouldReset(this.state.failed, previous.resetKeys ?? [], this.props.resetKeys ?? [])) {
            this.reset();
        }
    }

    reset(): void {
        this.setState(CLEAR);
    }

    override render(): ReactNode {
        if (!this.state.failed) {
            return this.props.children;
        }
        const { label, compact = false, reload = false, className = 'absolute inset-0' } = this.props;
        return (
            <ErrorFallback
                label={label}
                error={this.state.error}
                componentStack={this.state.componentStack}
                compact={compact}
                reload={reload}
                className={className}
                onRetry={() => this.reset()}
            />
        );
    }
}
