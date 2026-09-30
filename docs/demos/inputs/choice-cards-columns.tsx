import { useState } from 'react';
import { FileText, Image, Music, Video } from 'lucide-react';
import { ChoiceCards } from '@basmilius/react-ui';

type Kind = 'document' | 'image' | 'audio' | 'video';

export default function ChoiceCardsColumns() {
    const [kind, setKind] = useState<Kind>('document');

    return (
        <ChoiceCards<Kind>
            label="What to create"
            columns={2}
            className="w-full max-w-xl"
            value={kind}
            onValueChange={setKind}
            choices={[
                { value: 'document', title: 'Document', description: 'Text with headings, lists and tables.', icon: FileText },
                { value: 'image', title: 'Image', description: 'A picture to draw on or crop.', icon: Image },
                { value: 'audio', title: 'Audio', description: 'A recording to trim and mix.', icon: Music },
                { value: 'video', title: 'Video', description: 'Clips on a timeline, cut to length.', icon: Video }
            ]}
        />
    );
}
