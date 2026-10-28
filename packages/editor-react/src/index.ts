export { EditorLanguage, type EditorLanguageOptions } from './editor-language.ts';
export { KEY_PRIORITY } from './key-priority.ts';
export { realTimers, type Timers } from './timers.ts';
export { type SemanticTokensOptions } from './semantic-tokens.ts';
export { ProjectLanguage, type FileOperationTarget } from './project-language.ts';
export type { AcquireOptions, LanguageDocumentHandle } from './project-language.ts';

export type {
    SnippetVariableContext,
    LanguageHost,
    DiskText,
    GitBlameCommit,
    GitBlameResult,
    EditorNotification,
    RenameSuggestionsRequest
} from './host-types.ts';

export { EditorView } from './EditorView.tsx';
export { createHolder } from './holder.ts';
export type { EditorViewProps } from './EditorView.tsx';
export { LanguagePopups } from './LanguagePopups.tsx';
export type { LanguagePopupsProps } from './LanguagePopups.tsx';
export { AnchoredPopup } from './AnchoredPopup.tsx';
export { SignatureCard } from './SignatureCard.tsx';
export { type RenderedDocsFeature } from './rendered-docs.ts';
export { type DocumentLinksFeature } from './document-links.ts';
export { type DocumentColorsFeature } from './document-colors.ts';
export { type LinkedEditingFeature } from './linked-editing.ts';
export { type InlineCompletionFeature, type InlineSuggestion } from './inline-completion.ts';
export type { RenderedDocEntry, RenderedDocsSettings } from './rendered-docs.ts';
export type { DocTagEntry, DocTagSection, ParsedDocComment } from './doc-comment-model.ts';
export { EditorRenderingProvider } from './rendering.tsx';
export type { EditorRendering } from './rendering-context.ts';
export { FindReplace } from './FindReplace.tsx';
export { ChangeReview } from './ChangeReview.tsx';
export type { ChangeReviewProps } from './ChangeReview.tsx';
export { ProjectProblems, serviceProblems, countsOf } from './project-problems.ts';
export type { ProblemFile, ProblemRow, ProblemReport, ProblemSource } from './project-problems.ts';
export { applyWorkspaceEdit, supportedResourceOperations } from './workspace-edit.ts';
export type { ProjectFiles, StagedFile, WorkspaceEditHost } from './workspace-edit.ts';
export { useProblemCounts } from './use-problem-counts.ts';
export type { ProblemCounts } from './diagnostics.ts';
export type { BlameSource, CodeVisionSettings } from './code-vision.ts';
export type { HoverSettings } from './hover.ts';

export type {
    PopupState,
    PopupStore,
    HoverInfo,
    HoverView,
    CompletionView,
    CompletionDocs,
    CompletionRow,
    SignatureView,
    RenameView,
    RenameFileView,
    PeekView,
    CallHierarchyView,
    PickView,
    PickGroup,
    PickRow,
    PickPreview,
    SymbolsView,
    MenuView,
    AuthorsView,
    WrapView
} from './popups.ts';
export { type MarkupFeature } from './markup.ts';
export type { MarkupSettings } from './markup.ts';
export { RowHost, LineActionHost } from './row-host.ts';
export type { HostedRow, HostedAction } from './row-host.ts';
export { type HighlightLayers, highlightLayers } from './highlight-layers.ts';
export { type NavigationHistory } from './navigation-history.ts';
export type { Place } from './navigation-history.ts';
export { EditLocations, type EditPlace } from './edit-locations.ts';
export { ClipboardHistory, type ClipboardEntry, type ClipboardHistoryOptions } from './clipboard-history.ts';
export { type PasteHistoryFeature } from './paste-history.ts';
export {
    TemplateRegistry,
    checkTemplate,
    BUILT_IN_LIVE_TEMPLATES,
    BUILT_IN_POSTFIX_TEMPLATES,
    type TemplatesFeature,
    type LiveTemplate,
    type PostfixTemplate,
    type LiveTemplateDraft,
    type TemplateLanguage,
    type TemplatePlace,
    type TemplateSettings,
    type TemplateRegistryOptions,
    type TemplateUpdate
} from './templates.ts';
export { openingPlace, viewStates, followViewStates, viewStateKey, forgetMovesFrom } from './view-state.ts';
export type { ViewState, RevealLineRequest } from './view-state.ts';
export { lspLanguageIdOf, shikiLanguageOf, shikiLanguageOfPath } from './language-ids.ts';
export { AttributionCard } from './AttributionCard.tsx';
export type { AttributionCardProps } from './AttributionCard.tsx';
export { ReviewGroup, joinReviewGroup } from './review-group.ts';
export type { ReviewMember } from './review-group.ts';
export { DiffView } from './DiffView.tsx';
export type { DiffViewProps } from './DiffView.tsx';
export type { DiffLimits } from './diff-expansion.ts';
export { diffSyntaxDocument } from './diff-syntax.ts';
export type { DiffSourceSide, DiffSourceTokens, DiffSyntaxSources } from './diff-syntax.ts';
export { decoratePatch, usePatchDecorations } from './patch-decorations.ts';
export type { PatchDecoration, PatchDecorationOptions, PatchLineLabels, PatchTimer } from './patch-decorations.ts';
