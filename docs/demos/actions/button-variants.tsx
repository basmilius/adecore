import { Button } from '@basmilius/react-ui';

export default function ButtonVariants() {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary">Publish</Button>
            <Button variant="secondary">Save draft</Button>
            <Button>Cancel</Button>
            <Button variant="danger">Delete</Button>
            <Button variant="danger-outline">Forget</Button>
            <Button variant="positive">Merge</Button>
            <Button variant="inverse">Sign in</Button>
        </div>
    );
}
