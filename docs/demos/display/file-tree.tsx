import { useState } from 'react';
import { FileTree, useFileTree } from '@adecore/ui';

export default function FileTreeDemo() {
    const [viewed, setViewed] = useState<ReadonlySet<string>>(new Set());
    const [opened, setOpened] = useState<string | null>(null);
    const { model } = useFileTree({
        paths: ['src/components/Button.tsx', 'src/components/Checkbox.tsx', 'src/utilities/path.ts', 'README.md'],
        initialExpansion: 'open',
        flattenEmptyDirectories: true
    });
    return (
        <div className="w-80">
            <FileTree.Root
                model={model}
                label="Project files"
                onActivate={setOpened}
                className="h-48"
                renderControl={(row) =>
                    row.kind === 'file' ? (
                        <FileTree.Checkbox
                            label={`Viewed ${row.path}`}
                            checked={viewed.has(row.path)}
                            onCheckedChange={(checked) =>
                                setViewed((current) => {
                                    const next = new Set(current);
                                    if (checked) {
                                        next.add(row.path);
                                    } else {
                                        next.delete(row.path);
                                    }
                                    return next;
                                })
                            }
                        />
                    ) : null
                }
                renderDecoration={(row) => (row.kind === 'file' ? <span className="font-mono text-xs text-text-faint">+2</span> : null)}
            />
            {opened !== null && <p className="mt-2 truncate text-xs text-text-muted">{opened}</p>}
        </div>
    );
}
