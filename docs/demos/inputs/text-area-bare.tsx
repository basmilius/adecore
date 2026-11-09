import { Button, TextArea } from '@adecore/ui';

export default function TextAreaBare() {
    return (
        <div className="flex w-80 flex-col rounded-lg border border-border bg-surface-sunken has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:-outline-offset-1 has-[textarea:focus-visible]:outline-accent-on-surface">
            <TextArea variant="bare" size="sm" rows={3} aria-label="Commit message" placeholder="Commit message" />
            <div className="flex justify-end p-1.5">
                <Button size="sm" variant="primary">
                    Commit
                </Button>
            </div>
        </div>
    );
}
