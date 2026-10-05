import { Button } from '@adecore/ui';
import type { FakeLanguageService } from '@adecore/editor-react/testing';
import { LanguageFrame } from '../shared/editor-frame.tsx';
import { useDemoLanguage } from '../shared/editor.ts';
import { respondNavigation, respondSymbols } from '../shared/order-service.ts';

function configure(service: FakeLanguageService): void {
    respondNavigation(service);
    respondSymbols(service);
}

export default function NavigationDemo() {
    const { project, language, onMount } = useDemoLanguage(configure);

    const at = (line: number, character: number): void => {
        language?.editor.setCaret({ line, character });
        language?.editor.focus();
    };

    return (
        <LanguageFrame
            project={project}
            onMount={onMount}
            toolbar={
                <>
                    <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => {
                            at(13, 40);
                            void language?.navigation.go('definition');
                        }}
                    >
                        Definitions of `formatNumber`
                    </Button>
                    <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => {
                            at(3, 20);
                            void language?.peek.open();
                        }}
                    >
                        Peek uses of `orderTotal`
                    </Button>
                    <Button size="xs" variant="secondary" onClick={() => void language?.symbolPicker.open()}>
                        Go to symbol
                    </Button>
                </>
            }
        />
    );
}
