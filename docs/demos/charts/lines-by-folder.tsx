import { createChart } from '@adecore/charts';
import { formatNumber } from '@adecore/ui/format';

interface FolderLines {
    readonly path: string;
    readonly code: number;
    readonly tests: number;
}

const FolderChart = createChart<FolderLines>();

const FOLDERS: FolderLines[] = [
    { path: 'packages/editor/src/language/mirror', code: 18_420, tests: 9_310 },
    { path: 'packages/agents/src/chat', code: 14_960, tests: 8_120 },
    { path: 'packages/ui/src', code: 12_870, tests: 4_380 },
    { path: 'packages/database/helper/src', code: 9_640, tests: 3_020 },
    { path: 'packages/agents-react/src/composer', code: 7_210, tests: 2_440 },
    { path: 'packages/charts/src', code: 5_980, tests: 2_710 },
    { path: 'packages/terminal/src', code: 2_310, tests: 640 },
    { path: 'scripts', code: 1_480, tests: 220 }
];

const MEDIAN = 11_155;

export default function LinesByFolderDemo() {
    return (
        <FolderChart.Root data={FOLDERS} x="path" orientation="horizontal" label="Lines of code per folder" format={formatNumber} className="w-full">
            <FolderChart.Grid />
            <FolderChart.YAxis ticks={4} />
            <FolderChart.XAxis />
            <FolderChart.Bars stack>
                <FolderChart.Bar value="code" label="Code" />
                <FolderChart.Bar value="tests" label="Tests" valueLabels />
            </FolderChart.Bars>
            <FolderChart.Rule value={MEDIAN} label="Median" dashed />
            <FolderChart.Tooltip total />
            <FolderChart.Legend />
            <FolderChart.Table />
        </FolderChart.Root>
    );
}
