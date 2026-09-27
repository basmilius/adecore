import { useState } from 'react';
import { Button, Input, Popover } from '@basmilius/react-ui';

const PEOPLE = ['Ada Lovelace', 'Alan Turing', 'Grace Hopper', 'Katherine Johnson', 'Margaret Hamilton'];

export default function PopoverPicker() {
    const [query, setQuery] = useState('');
    const matches = PEOPLE.filter((person) => person.toLowerCase().includes(query.toLowerCase()));

    return (
        <Popover.Root>
            <Popover.Trigger render={<Button variant="secondary" />}>Assign</Popover.Trigger>
            <Popover.Popup variant="picker">
                <div className="border-b border-border p-1">
                    <Input
                        size="sm"
                        aria-label="Find a person"
                        placeholder="Find a person"
                        className="border-transparent"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </div>
                <ul className="max-h-60 overflow-auto p-1">
                    {matches.map((person) => (
                        <li key={person} className="rounded-md px-2.5 py-1.5 text-sm text-text hover:bg-surface-hover">
                            {person}
                        </li>
                    ))}
                </ul>
            </Popover.Popup>
        </Popover.Root>
    );
}
