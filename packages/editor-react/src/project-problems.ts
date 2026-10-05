import type { Diagnostic } from '@adecore/lsp';
import type { LanguageService } from '@adecore/lsp';
import { comparePositions, severityOf } from './diagnostics-model.ts';
import type { ProblemCounts } from './diagnostics.ts';

/* One problem of a file and the server that reported it. */
export interface ProblemRow {
    readonly diagnostic: Diagnostic;
    readonly server: string;
}

/* A file with problems; its path is a stored path (relative to the project folder, absolute outside it). */
export interface ProblemFile {
    readonly path: string;
    readonly rows: readonly ProblemRow[];
}

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2, hint: 3 } as const;

/* Worst first, then in the order of the file. */
export function compareRows(left: ProblemRow, right: ProblemRow): number {
    return (
        SEVERITY_ORDER[severityOf(left.diagnostic)] - SEVERITY_ORDER[severityOf(right.diagnostic)] ||
        comparePositions(left.diagnostic.range.start, right.diagnostic.range.start)
    );
}

/*
 * Each report replaces the previous diagnostics from that source for the file. Files with no
 * remaining problems drop out. Hints remain editor annotations rather than listed problems.
 */
export class ProjectProblems {
    private readonly reports = new Map<string, Map<string, readonly Diagnostic[]>>();
    private readonly listeners = new Set<() => void>();
    private readonly stop: () => void;
    private snapshot: readonly ProblemFile[] = [];

    constructor(service: LanguageService, pathOf: (uri: string) => string = (uri) => uri) {
        const subscription = service.onDiagnostics((report) => this.report(pathOf(report.uri), report.source, report.diagnostics));
        this.stop = () => subscription.dispose();
    }

    report(path: string, server: string, diagnostics: readonly Diagnostic[]): void {
        const kept = diagnostics.filter((diagnostic) => severityOf(diagnostic) !== 'hint');
        const servers = this.reports.get(path) ?? new Map<string, readonly Diagnostic[]>();
        if (kept.length === 0) {
            servers.delete(server);
        } else {
            servers.set(server, kept);
        }
        if (servers.size === 0) {
            this.reports.delete(path);
        } else {
            this.reports.set(path, servers);
        }
        this.snapshot = [...this.reports]
            .map(([file, byServer]): ProblemFile => ({
                path: file,
                rows: [...byServer].flatMap(([name, list]) => list.map((diagnostic): ProblemRow => ({ diagnostic, server: name }))).sort(compareRows)
            }))
            .sort((left, right) => left.path.localeCompare(right.path));
        for (const listener of [...this.listeners]) {
            listener();
        }
    }

    /* The same array until the next report, which is what a store a component reads must hand out. */
    getSnapshot = (): readonly ProblemFile[] => this.snapshot;

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    dispose(): void {
        this.stop();
        this.listeners.clear();
    }
}

export function countsOf(files: readonly ProblemFile[]): ProblemCounts {
    const rows = files.flatMap((file) => file.rows);
    const count = (severity: number): number => rows.filter((row) => (row.diagnostic.severity ?? 1) === severity).length;
    return { error: count(1), warning: count(2), info: count(3) };
}
