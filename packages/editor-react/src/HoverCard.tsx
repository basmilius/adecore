import { useTranslation } from 'react-i18next';
import { CircleX, Info, TriangleAlert } from 'lucide-react';
import { fileUriToPath } from '@adecore/lsp';
import { Button, Icon, Tooltip } from '@adecore/ui';
import { formatNumber } from '@adecore/ui/format';
import type { EditorPosition } from '@adecore/editor';
import { basenameOf } from './paths.ts';
import type { EditorLanguage } from './editor-language.ts';
import { codeLabelOf, severityOf, type Problem } from './diagnostics-model.ts';
import type { HoverInfo } from './popups.ts';
import { SymbolSections } from './HoverSections.tsx';

const SEVERITY_ICONS = { error: CircleX, warning: TriangleAlert, info: Info, hint: Info } as const;
const SEVERITY_COLORS = { error: 'text-status-error', warning: 'text-status-needs-you', info: 'text-status-running', hint: 'text-text-muted' } as const;

function ProblemSection({ problem, language }: { problem: Problem; language: EditorLanguage }) {
    const { t } = useTranslation('editor');
    const { diagnostic } = problem;
    const severity = severityOf(diagnostic);
    const label =
        diagnostic.source === undefined ? [codeLabelOf(diagnostic), problem.server].filter((part) => part !== '').join(' · ') : codeLabelOf(diagnostic);
    const supported = language.codeActions.supported;
    return (
        <div className="flex flex-col gap-1.5 px-3 py-2.5">
            <div className="flex items-start gap-2">
                <Icon icon={SEVERITY_ICONS[severity]} size={14} className={`mt-px shrink-0 ${SEVERITY_COLORS[severity]}`} />
                <div className="min-w-0 text-xs/[18px] break-words whitespace-pre-wrap select-text">{diagnostic.message}</div>
            </div>
            {label !== '' && <div className="pl-[22px] text-xs text-text-muted select-text">{label}</div>}
            {diagnostic.relatedInformation?.map((related, index) => {
                const path = fileUriToPath(related.location.uri);
                return (
                    <div key={index} className="pl-[22px] text-xs text-text-muted">
                        {path !== null && (
                            <button type="button" className="font-mono text-accent hover:underline" onClick={() => language.goTo(related.location)}>
                                {basenameOf(path)}:{formatNumber(related.location.range.start.line + 1)}
                            </button>
                        )}{' '}
                        {related.message}
                    </div>
                );
            })}
            <div className="pt-1 pl-[22px]">
                <Tooltip label={t(supported ? 'language.hover.quickFix' : 'language.hover.quickFixNone')}>
                    <Button
                        size="xs"
                        variant="secondary"
                        aria-disabled={!supported}
                        onClick={() => {
                            if (supported) {
                                language.hover.hide();
                                void language.codeActions.quickFixFor(problem);
                            }
                        }}
                    >
                        {t('language.hover.quickFix')}
                    </Button>
                </Tooltip>
            </div>
        </div>
    );
}

export function HoverCard({
    language,
    problems,
    info,
    anchor,
    position
}: {
    language: EditorLanguage;
    problems: readonly Problem[];
    info: HoverInfo | null;
    anchor: EditorPosition;
    position: EditorPosition;
}) {
    const { t } = useTranslation('editor');
    const place = info?.definition === null || info === null ? null : fileUriToPath(info.definition.uri);
    return (
        <div className="flex w-max min-w-[280px] max-w-[min(520px,calc(100vw-16px))] flex-col divide-y divide-border">
            {info !== null && (
                <>
                    <SymbolSections
                        text={info.text}
                        onName={(name, declared) => {
                            language.hover.hide();
                            void language.navigation.goToName(name, anchor, name === (declared ?? info.word) ? info.definition : null);
                        }}
                    />
                    <div className="flex items-center gap-3 px-3 py-1.5 text-xs">
                        {info.definition !== null && (
                            <button type="button" className="text-accent hover:underline" onClick={() => language.goTo(info.definition!)}>
                                {t('language.hover.definition')}
                            </button>
                        )}
                        {info.references !== null && info.references > 0 && (
                            <button
                                type="button"
                                className="text-accent hover:underline"
                                onClick={() => {
                                    language.hover.hide();
                                    void language.peek.open(position);
                                }}
                            >
                                {t('language.hover.references', { count: info.references, formatted: formatNumber(info.references) })}
                            </button>
                        )}
                        {place !== null && info.definition !== null && (
                            <span className="ml-auto font-mono text-text-faint">
                                {basenameOf(place)}:{formatNumber(info.definition.range.start.line + 1)}
                            </span>
                        )}
                    </div>
                </>
            )}
            {problems.map((problem, index) => (
                <ProblemSection key={index} problem={problem} language={language} />
            ))}
        </div>
    );
}
