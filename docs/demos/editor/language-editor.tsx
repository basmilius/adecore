import { LanguageFrame } from '../shared/editor-frame.tsx';
import { useDemoLanguage } from '../shared/editor.ts';
import {
    reportProblems,
    respondCodeActions,
    respondCompletion,
    respondHighlights,
    respondHover,
    respondNavigation,
    respondRename,
    respondSignatureHelp,
    respondSymbols
} from '../shared/order-service.ts';
import type { FakeLanguageService } from '@adecore/editor-react/testing';

/* Every feature the fake service answers for, as a real TypeScript server would. */
function configure(service: FakeLanguageService): void {
    respondCompletion(service);
    respondSignatureHelp(service);
    respondHover(service);
    respondNavigation(service);
    respondSymbols(service);
    respondHighlights(service);
    respondRename(service);
    respondCodeActions(service);
    reportProblems(service);
}

export default function LanguageEditorDemo() {
    const { project, onMount } = useDemoLanguage(configure);

    return (
        <LanguageFrame
            project={project}
            onMount={onMount}
            className="h-96"
            toolbar={
                <span className="px-1 text-xs text-text-muted">
                    Type `line.` for suggestions, rest the pointer on a name, Ctrl+click `orderTotal`, or right-click.
                </span>
            }
        />
    );
}
