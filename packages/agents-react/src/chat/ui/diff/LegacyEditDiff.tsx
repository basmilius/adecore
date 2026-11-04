import { ScrollArea } from '@adecore/ui';
import { MultiFileDiff } from '@pierre/diffs/react';
import { useHostCodeMode } from '../../../host-hooks';
import { diffTexts, type FileChange } from '../../logic/tools';
import { useDiffTheme } from '../diff-theme';
import { LegacyDiffPool } from './LegacyDiffPool';
import { useReviewSettled } from './review-settle';

export default function LegacyEditDiff({ change, maxHeight }: { change: FileChange; maxHeight?: number }) {
    useReviewSettled();
    const resolved = useHostCodeMode();
    const theme = useDiffTheme();
    const { before, after } = diffTexts(change);
    const oldFile = { name: change.path, contents: before };
    const newFile = { name: change.path, contents: after };

    const options = {
        diffStyle: 'unified' as const,
        theme,
        themeType: resolved,
        disableFileHeader: true,
        disableLineNumbers: change.fragment === true,
        overflow: 'wrap' as const,
        hunkSeparators: 'simple' as const
    };

    const body = (
        <LegacyDiffPool>
            <MultiFileDiff oldFile={oldFile} newFile={newFile} options={options} />
        </LegacyDiffPool>
    );

    if (maxHeight === undefined) {
        return <div className="chat-diff select-text">{body}</div>;
    }

    return (
        <ScrollArea axis="both" className="chat-diff select-text" style={{ maxHeight }}>
            {body}
        </ScrollArea>
    );
}
