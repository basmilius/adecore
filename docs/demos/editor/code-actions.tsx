import { Button } from '@adecore/ui';
import type { FakeLanguageService } from '@adecore/editor-react/testing';
import { LanguageFrame } from '../shared/editor-frame.tsx';
import { useDemoLanguage } from '../shared/editor.ts';
import { reportProblems, respondCodeActions, respondNavigation, respondRename } from '../shared/order-service.ts';

function configure(service: FakeLanguageService): void {
    reportProblems(service);
    respondCodeActions(service);
    respondNavigation(service);
    respondRename(service);
}

export default function CodeActionsDemo() {
    const { project, language, onMount } = useDemoLanguage(configure);

    const fixes = (): void => {
        language?.editor.setCaret({ line: 3, character: 36 });
        language?.editor.focus();
        void language?.codeActions.open();
    };

    return (
        <LanguageFrame
            project={project}
            onMount={onMount}
            toolbar={
                <>
                    <Button size="xs" variant="secondary" onClick={fixes}>
                        Fixes for line 4
                    </Button>
                    <span className="text-xs text-text-muted">or right-click a name for the context menu</span>
                </>
            }
        />
    );
}
