import { LegacyDiffPool } from './LegacyDiffPool';
import { useReviewSettled } from './review-settle';
import { MultiFileDiff } from '@pierre/diffs/react';
import { useDiffTheme } from '../diff-theme';
import type { FileChange } from '../../logic/tools';
import { useHostCodeMode } from '../../../host-hooks';

export default function LegacyEditDiff({ change, maxHeight }: { change: FileChange; maxHeight?: number }) {
    useReviewSettled();
    const resolved = useHostCodeMode();
    const theme = useDiffTheme();
    const oldFile = { name: change.path, contents: change.before };
    const newFile = { name: change.path, contents: change.after };

    const options = {
        diffStyle: 'unified' as const,
        theme,
        themeType: resolved,
        disableFileHeader: true,
        overflow: 'wrap' as const,
        hunkSeparators: 'simple' as const
    };

    return (
        <div className="chat-diff select-text" style={maxHeight === undefined ? undefined : { maxHeight, overflow: 'auto' }}>
            <LegacyDiffPool>
                <MultiFileDiff oldFile={oldFile} newFile={newFile} options={options} />
            </LegacyDiffPool>
        </div>
    );
}
