import { ui } from '../shared/intelligent-ui-tree.ts';
import { DemoBlock } from '../shared/intelligent-ui.tsx';

export default function StatusDemo() {
    return (
        <DemoBlock
            nodes={[
                ui('Summary', { tone: 'warning', badge: '1 failing', detail: 'Build 4812 on main' }, 'The release build passed, one smoke test failed'),
                ui('Callout', { tone: 'info', title: 'Retried once' }, 'The test failed again on a clean runner.'),
                ui('Callout', { tone: 'danger', title: 'Do not publish' }, 'The failing test covers sign in.'),
                ui('Progress', { value: 312, max: 500, tone: 'warning', detail: '188 tests left' }, 'Tests run'),
                ui(
                    'Steps',
                    {},
                    ui('Step', { state: 'done', detail: '2 min' }, 'Build'),
                    ui('Step', { state: 'failed', detail: 'login.spec.ts' }, 'Smoke tests'),
                    ui('Step', { state: 'pending' }, 'Publish')
                ),
                ui('Tag', { tone: 'danger' }, 'blocking'),
                ui(
                    'Timeline',
                    {},
                    ui('Event', { at: '14:02', tone: 'warning', detail: 'p95 above 2 s' }, 'Alert fired'),
                    ui('Event', { at: '14:09', tone: 'info' }, 'Rolled back the release'),
                    ui('Event', { at: '2026-10-14T14:14:00+02:00', tone: 'success' }, 'Recovered')
                )
            ]}
        />
    );
}
