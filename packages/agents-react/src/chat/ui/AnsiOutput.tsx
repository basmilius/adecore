import { useTranslation } from 'react-i18next';
import { parseAnsi } from '../logic/ansi';

/* `marksOmitted` off leaves out the count of what the limit cut, for a text that is itself only a beginning. */
export function AnsiOutput({
    text,
    limit,
    tailLines,
    marksOmitted = true
}: {
    text: string;
    limit?: number | undefined;
    tailLines?: number;
    marksOmitted?: boolean;
}) {
    const { t } = useTranslation('agent-chat');
    const { tokens, omitted } = parseAnsi(text, { limit, tailLines });

    return (
        <>
            {tokens.map((token, index) => (
                <span key={index} style={token.style}>
                    {token.content}
                </span>
            ))}
            {marksOmitted && omitted > 0 && `\n${t('work.moreCharacters', { count: omitted })}`}
        </>
    );
}
