/* The settings dialog and the parts a pane is built from. */

export { ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog.tsx';
export { DetailHeader, type DetailHeaderProps } from './DetailHeader.tsx';
export { MasterDetail, MasterItem, type MasterDetailProps, type MasterItemProps } from './MasterDetail.tsx';
export {
    SettingsDialog,
    type SettingsDialogProps,
    type SettingsGroupEntry,
    type SettingsSearch,
    type SettingsSearchResult,
    type SettingsSectionEntry
} from './SettingsDialog.tsx';
export { SettingsRow, TopIcon, type SettingsRowProps, type TopIconProps } from './SettingsRow.tsx';
export { SettingsSection, type SettingsSectionProps } from './SettingsSection.tsx';
export { useSettingsTarget } from './target.ts';
