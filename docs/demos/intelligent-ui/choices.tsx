import { DemoBlock } from '../shared/intelligent-ui.tsx';
import { ui } from '../shared/intelligent-ui-tree.ts';

export default function ChoicesDemo() {
    return (
        <DemoBlock
            nodes={[
                ui('Summary', {}, 'Two ways to fix the flaky test'),
                ui(
                    'Choices',
                    {},
                    ui('Choice', { primary: true, context: 'Wait for the login request before asserting.' }, 'Wait for the request'),
                    ui('Choice', { context: 'Raise the timeout of the login step to ten seconds.' }, 'Raise the timeout'),
                    ui('Choice', { disabled: true }, 'Skip the test')
                )
            ]}
        />
    );
}
