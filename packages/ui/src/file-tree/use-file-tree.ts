import type { FileTreeOptions as PierreOptions } from '@pierre/trees';
import { useFileTree as usePierreFileTree } from '@pierre/trees/react';
import { useLayoutEffect, useRef } from 'react';
import { FILE_TREE_ICONS } from '../file-icon.ts';
import { TREE_ROW_HEIGHT } from '../tree/style.ts';
import { compareRows } from './helpers.ts';
import { FILE_TREE_CSS } from './style.ts';

type WithoutSizing<Options> = Options extends unknown ? Omit<Options, 'itemHeight' | 'density'> : never;
export type FileTreeOptions = WithoutSizing<PierreOptions>;

// Model options are initial; paths and status can subsequently change through the model's mutation methods.
export function useFileTree(options: FileTreeOptions) {
    const latest = useRef(options.onSelectionChange);
    useLayoutEffect(() => {
        latest.current = options.onSelectionChange;
    }, [options.onSelectionChange]);
    return usePierreFileTree({
        composition: { contextMenu: { enabled: false } },
        icons: FILE_TREE_ICONS,
        initialExpansion: 'closed',
        search: false,
        stickyFolders: false,
        sort: compareRows,
        ...options,
        density: 'compact',
        itemHeight: TREE_ROW_HEIGHT,
        onSelectionChange: (paths) => latest.current?.(paths),
        unsafeCSS: `${FILE_TREE_CSS}\n${options.unsafeCSS ?? ''}`
    });
}
