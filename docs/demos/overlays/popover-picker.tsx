import { Button, Input, Popover, ScrollArea } from '@adecore/ui';
import { useState } from 'react';

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
                <ScrollArea render={<ul />} className="max-h-60" viewportClassName="p-1">
                    {matches.map((person) => (
                        <li key={person} className="rounded-md px-2.5 py-1.5 text-sm text-text hover:bg-surface-hover">
                            {person}
                        </li>
                    ))}
                </ScrollArea>
            </Popover.Popup>
        </Popover.Root>
    );
}
