import { StatStrip } from '@adecore/ui';

export default function StatStripDemo() {
    return (
        <StatStrip.Root className="w-full">
            <StatStrip.Item label="Open issues" value="48" note="Each counted once" />
            <StatStrip.Item label="Error events" value="1,365" />
            <StatStrip.Item label="Sessions" value="25,723" />
            <StatStrip.Item label="Crash-free sessions" value="99.2%" note="Last 7 days" />
        </StatStrip.Root>
    );
}
