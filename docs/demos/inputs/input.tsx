import { Field, Input, TextArea } from '@basmilius/react-ui';

export default function InputDemo() {
    return (
        <div className="flex w-80 flex-col gap-4">
            <Field label="Title">
                <Input placeholder="Add a title" />
            </Field>
            <Field label="Path">
                <Input mono defaultValue="src/components/Button.tsx" />
            </Field>
            <Input size="sm" aria-label="Filter" placeholder="Filter" />
            <Field label="Description">
                <TextArea rows={4} placeholder="What does this change?" />
            </Field>
            <TextArea size="sm" resize="vertical" aria-label="Commit message" placeholder="Commit message" />
        </div>
    );
}
