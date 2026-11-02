import { useEffect, useState } from 'react';
import { User, Users } from 'lucide-react';
import { Combobox, Icon, Spinner, matchScore } from '@adecore/ui';

interface Person {
    id: string;
    name: string;
    role: string;
    team: boolean;
}

interface Group {
    value: string;
    items: Person[];
}

const PEOPLE: Person[] = [
    { id: 'ada', name: 'Ada Lovelace', role: 'Engines', team: false },
    { id: 'alan', name: 'Alan Turing', role: 'Codes', team: false },
    { id: 'grace', name: 'Grace Hopper', role: 'Compilers', team: false },
    { id: 'design', name: 'Design', role: '4 people', team: true },
    { id: 'desktop', name: 'Desktop', role: '6 people', team: true }
];

/* Stands in for a request: the answer lands a moment after the last key. */
function useSearch(query: string): { groups: Group[]; searching: boolean } {
    const [answer, setAnswer] = useState<{ query: string; groups: Group[] }>({ query: '', groups: [] });

    useEffect(() => {
        if (query.trim() === '') {
            return;
        }

        const timer = window.setTimeout(() => {
            const found = PEOPLE.filter((person) => matchScore(person.name, query) !== null);

            const groups = [
                { value: 'People', items: found.filter((person) => !person.team) },
                { value: 'Teams', items: found.filter((person) => person.team) }
            ].filter((group) => group.items.length > 0);
            setAnswer({ query, groups });
        }, 400);

        return () => window.clearTimeout(timer);
    }, [query]);

    // The last answer stays until the next one lands, so the list does not flicker while typing.
    return { groups: query.trim() === '' ? [] : answer.groups, searching: query.trim() !== '' && answer.query !== query };
}

export default function ComboboxAsyncDemo() {
    const [query, setQuery] = useState('');
    const { groups, searching } = useSearch(query);

    return (
        <div className="w-80">
            <Combobox.Root items={groups} filter={null} value={query} onValueChange={setQuery} itemToStringValue={(person: Person) => person.name}>
                <Combobox.Input aria-label="Assign to" placeholder="Assign to a person or a team" />
                <Combobox.Popup aria-busy={searching || undefined}>
                    <Combobox.Status>
                        {searching && (
                            <span className="flex items-center justify-center gap-2">
                                <Spinner size={12} /> Searching
                            </span>
                        )}
                    </Combobox.Status>
                    <Combobox.Empty>{!searching && 'Nobody by that name'}</Combobox.Empty>
                    <Combobox.List>
                        {(group: Group) => (
                            <Combobox.Group key={group.value} items={group.items}>
                                <Combobox.GroupLabel>{group.value}</Combobox.GroupLabel>
                                <Combobox.Collection>
                                    {(person: Person) => (
                                        <Combobox.Item
                                            key={person.id}
                                            value={person}
                                            icon={<Icon icon={person.team ? Users : User} size={14} />}
                                            description={person.role}
                                        >
                                            {person.name}
                                        </Combobox.Item>
                                    )}
                                </Combobox.Collection>
                            </Combobox.Group>
                        )}
                    </Combobox.List>
                </Combobox.Popup>
            </Combobox.Root>
        </div>
    );
}
