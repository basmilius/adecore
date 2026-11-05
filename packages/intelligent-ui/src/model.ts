import type { UiDiagnostic } from './syntax.ts';

export interface UiBinding<Value> {
    value: Value;
    onValueChange(value: Value): void;
}

export interface UiViewNode<Props = Record<string, unknown>> {
    id: string;
    sourceId?: string;
    type: string;
    props: Props;
    bindings: Readonly<Record<string, UiBinding<unknown>>>;
    children: UiViewNode[];
    complete: boolean;
    fallback: string;
    error?: string;
    // How many children a container left out because it holds at most so many of its kind; absent when it left none out.
    omitted?: number;
    // Runs the node's state action; present only on a component that has one.
    onAction?(): void;
}

export interface UiEvaluation {
    nodes: UiViewNode[];
    diagnostics: UiDiagnostic[];
}
