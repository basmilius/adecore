import { useState } from 'react';
import { ChoiceCards, Field, Input } from '@adecore/ui';

type Source = 'empty' | 'clone';

export default function ChoiceCardsVertical() {
    const [source, setSource] = useState<Source>('clone');

    return (
        <ChoiceCards<Source>
            label="How to start"
            orientation="vertical"
            radio="start"
            className="w-full max-w-md"
            value={source}
            onValueChange={setSource}
            choices={[
                { value: 'empty', title: 'An empty folder', description: 'Nothing in it yet.' },
                { value: 'clone', title: 'Clone a repository', description: 'Copy one from a remote.' }
            ]}
            detail={
                <Field label="Repository URL" className="px-1 pb-1">
                    <Input mono placeholder="git@github.com:owner/repo.git" />
                </Field>
            }
        />
    );
}
