import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/* Something of the app's own under a connection, such as a file that belongs to it. */
export interface ExplorerItem {
    /* Unique in its folder; it names the row. */
    readonly id: string;
    readonly label: string;
    readonly icon: LucideIcon;
    /*
     * A double click or Enter, with `preview: false`. With `openOnClick` a click opens it too, with
     * `preview: true`, the way a table opens.
     */
    onOpen?(options: { readonly preview: boolean }): void;
    /* The items of its context menu, as `ContextMenu.Item`s. Without them the row has no menu. */
    menu?: ReactNode;
}

/* A folder of the app's own under a connection, after its schemas. It shows only while it holds items. */
export interface ExplorerFolder {
    /* Unique among the folders of a connection; it keeps the folder open or closed across a remount. */
    readonly id: string;
    readonly label: string;
    readonly items: readonly ExplorerItem[];
}
