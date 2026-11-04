import { Combobox, matchScore } from '@adecore/ui';
import { Search } from 'lucide-react';
import { useState } from 'react';

const KEYS: Record<string, { about: string; values: string[] }> = {
    is: { about: 'unresolved, resolved or ignored', values: ['unresolved', 'resolved', 'ignored'] },
    level: { about: 'error, fatal, warning', values: ['error', 'fatal', 'warning'] },
    release: { about: 'A release, such as 1.5.0', values: ['1.5.0', '1.4.2', '1.4.1'] },
    environment: { about: 'production, staging', values: ['production', 'staging'] }
};

/* The word the caret sits in, at the end of the field here: a key so far, or a key and the start of its value. */
const lastWord = (text: string): { start: number; key: string | null; prefix: string } => {
    const start = text.lastIndexOf(' ') + 1;
    const word = text.slice(start);
    const colon = word.indexOf(':');

    return colon === -1 ? { start, key: null, prefix: word } : { start, key: word.slice(0, colon), prefix: word.slice(colon + 1) };
};

export default function ComboboxDemo() {
    const [text, setText] = useState('');
    const [focused, setFocused] = useState(false);
    const word = lastWord(text);
    const options = word.key === null ? Object.keys(KEYS) : (KEYS[word.key]?.values ?? []);
    const suggestions = options.filter((option) => matchScore(option, word.prefix) !== null);

    const accept = (suggestion: string): void => {
        const replacement = word.key === null ? `${suggestion}:` : `${word.key}:${suggestion} `;
        setText(text.slice(0, word.start) + replacement);
    };

    return (
        <div className="w-80">
            <Combobox.Root
                items={suggestions}
                filter={null}
                value={text}
                onValueChange={(next, details) => (details.reason === 'item-press' ? accept(next) : setText(next))}
                // Open as long as the field has focus, so taking a key leads straight to its values.
                open={focused && suggestions.length > 0}
                onOpenChange={(open, details) => details.reason !== 'item-press' && setFocused(open)}
                autoHighlight
            >
                <Combobox.Input
                    icon={Search}
                    aria-label="Search issues"
                    placeholder="Search, or filter as level:error"
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                />
                <Combobox.Popup>
                    <Combobox.List>
                        {(suggestion: string) => (
                            <Combobox.Item key={suggestion} value={suggestion} trailing={word.key === null ? KEYS[suggestion]?.about : undefined}>
                                {word.key === null ? <span className="font-mono text-code">{suggestion}:</span> : suggestion}
                            </Combobox.Item>
                        )}
                    </Combobox.List>
                </Combobox.Popup>
            </Combobox.Root>
        </div>
    );
}
