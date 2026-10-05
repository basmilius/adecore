import { Button } from '@adecore/ui';
import type { FakeLanguageService } from '@adecore/editor-react/testing';
import { LanguageFrame } from '../shared/editor-frame.tsx';
import { useDemoLanguage } from '../shared/editor.ts';
import { respondCompletion, respondSignatureHelp } from '../shared/order-service.ts';

function configure(service: FakeLanguageService): void {
    respondCompletion(service);
    respondSignatureHelp(service);
}

export default function CompletionDemo() {
    const { project, language, onMount } = useDemoLanguage(configure);

    const suggest = (): void => {
        language?.editor.setCaret({ line: 6, character: 22 });
        language?.editor.focus();
        language?.completion.invoke();
    };
    const parameters = (): void => {
        language?.editor.setCaret({ line: 12, character: 29 });
        language?.editor.focus();
        language?.signature.invoke();
    };

    return (
        <LanguageFrame
            project={project}
            onMount={onMount}
            toolbar={
                <>
                    <Button size="xs" variant="secondary" onClick={suggest}>
                        Suggest after `line.`
                    </Button>
                    <Button size="xs" variant="secondary" onClick={parameters}>
                        Parameters of `orderTotal`
                    </Button>
                </>
            }
        />
    );
}
