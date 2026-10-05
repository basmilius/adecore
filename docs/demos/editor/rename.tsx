import { Button } from '@adecore/ui';
import type { FakeLanguageService } from '@adecore/editor-react/testing';
import { LanguageFrame } from '../shared/editor-frame.tsx';
import { useDemoLanguage } from '../shared/editor.ts';
import { respondHighlights, respondNavigation, respondRename } from '../shared/order-service.ts';

function configure(service: FakeLanguageService): void {
    respondRename(service);
    respondHighlights(service);
    respondNavigation(service);
}

/* Type a new name and press Enter, or Shift+Enter to see what would change first. */
export default function RenameDemo() {
    const { project, language, onMount } = useDemoLanguage(configure);

    const rename = (): void => {
        language?.editor.setCaret({ line: 4, character: 10 });
        void language?.rename.start();
    };

    return (
        <LanguageFrame
            project={project}
            onMount={onMount}
            toolbar={
                <Button size="xs" variant="secondary" onClick={rename}>
                    Rename `total`
                </Button>
            }
        />
    );
}
