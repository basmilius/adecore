export { EditorLanguage, type EditorLanguageOptions } from './editor-language.ts';
export { KEY_PRIORITY } from './key-priority.ts';
export { realTimers, type Timers } from './timers.ts';
export { type SemanticTokensOptions } from './semantic-tokens.ts';
export { ProjectLanguage, type FileOperationTarget } from './project-language.ts';
export type { NavigationHost } from './navigation-history.ts';
export type { PanelsHost } from './panel-size.ts';
export type { ProblemsHost } from './project-problems.ts';
export type { TemplatesHost } from './templates.ts';
export type { ClipboardHost } from './clipboard-history.ts';
export type { AcquireOptions, LanguageDocumentHandle, LanguageServiceFactory } from './project-language.ts';

export type {
    SnippetVariableContext,
    LanguageHost,
    SnippetsHost,
    MessagesHost,
    RenameHost,
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
export {
    firstWord,
    type InlineCompletionFeature,
    type InlineSuggestion,
    type InlineSuggestionRequest,
    type InlineSuggestionSource
} from './inline-completion.ts';
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
export type { WorkspaceEditHost } from './workspace-edit.ts';
export type { ProjectFiles, StagedFile } from './host-types.ts';
export { useProblemCounts } from './use-problem-counts.ts';
export type { ProblemCounts } from './diagnostics-model.ts';
export type { BlameSource, CodeVisionSettings } from './code-vision.ts';
export type { HoverSettings } from './hover.ts';

export { Popups, PopupSlot, type PopupViews } from './popups.ts';
export type {
    HoverInfo,
    HoverView,
    CompletionView,
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
export type { CompletionDocs } from './completion-model.ts';
export { type MarkupFeature } from './markup.ts';
export { type SurroundFeature } from './surround.ts';
export type { MarkupSettings } from './markup.ts';
export { RowHost, LineActionHost } from './row-host.ts';
export type { HostedRow, HostedAction } from './row-host.ts';
export { type HighlightLayers, highlightLayers } from './highlight-layers.ts';
export { type NavigationHistory } from './navigation-history.ts';
export type { Place } from './navigation-history.ts';
export { EditLocations, type EditPlace } from './edit-locations.ts';
export { ClipboardHistory, type ClipboardEntry, type ClipboardHistoryOptions } from './clipboard-history.ts';
export { type PasteHistoryFeature } from './paste-history.ts';
export { type TemplatesFeature } from './live-templates.ts';
export {
    TemplateRegistry,
    checkTemplate,
    BUILT_IN_LIVE_TEMPLATES,
    BUILT_IN_POSTFIX_TEMPLATES,
    type LiveTemplateDraft,
    type TemplateSettings,
    type TemplateRegistryOptions,
    type TemplateUpdate
} from './templates.ts';
export { type LiveTemplate, type PostfixTemplate, type TemplateLanguage, type TemplatePlace } from './template-types.ts';
export { openingPlace, viewStates, followViewStates, viewStateKey, forgetMovesFrom } from './view-state.ts';
export type { ViewState, RevealLineRequest } from './view-state.ts';
export { lspLanguageIdOf, shikiLanguageOf, shikiLanguageOfPath } from './language-ids.ts';
export { AttributionCard } from './AttributionCard.tsx';
export type { AttributionCardProps } from './AttributionCard.tsx';
export { ReviewGroup, joinReviewGroup } from './review-group.ts';
export type { ReviewMember } from './review-group.ts';
export { DiffView } from './DiffView.tsx';
export type { DiffSource, DiffViewProps } from './diff-view-props.ts';
export type { DiffLimits } from './diff-expansion.ts';
export { diffSyntaxDocument } from './diff-syntax.ts';
export type { DiffSourceSide, DiffSourceTokens, DiffSyntaxSources } from './diff-syntax.ts';
export { decoratePatch, usePatchDecorations } from './patch-decorations.ts';
export type { PatchDecoration, PatchDecorationOptions, PatchLineLabels, PatchTimer } from './patch-decorations.ts';
