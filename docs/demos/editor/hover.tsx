import { Button } from '@adecore/ui';
import type { FakeLanguageService } from '@adecore/editor-react/testing';
import { LanguageFrame } from '../shared/editor-frame.tsx';
import { useDemoLanguage } from '../shared/editor.ts';
import { reportProblems, respondHover } from '../shared/order-service.ts';

function configure(service: FakeLanguageService): void {
    respondHover(service);
    reportProblems(service);
}

export default function HoverDemo() {
    const { project, language, onMount } = useDemoLanguage(configure);

    const show = (line: number, character: number): void => {
        language?.editor.setCaret({ line, character });
        language?.editor.focus();
        language?.hover.quickInfo();
    };

    return (
        <LanguageFrame
            project={project}
            onMount={onMount}
            toolbar={
                <>
                    <Button size="xs" variant="secondary" onClick={() => show(13, 40)}>
                        Quick info on `formatNumber`
                    </Button>
                    <Button size="xs" variant="secondary" onClick={() => show(3, 36)}>
                        The problem on line 4
                    </Button>
                </>
            }
        />
    );
}
