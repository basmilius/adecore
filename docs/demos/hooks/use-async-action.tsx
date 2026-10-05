import { Button, FormError, useAsyncAction } from '@adecore/ui';

const wait = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms));

let attempts = 0;

async function publish(): Promise<void> {
    await wait(900);
    attempts += 1;
    if (attempts % 2 === 1) {
        throw new Error('The registry refused the upload: the version already exists.');
    }
}

export default function UseAsyncActionDemo() {
    const step = useAsyncAction('Publishing failed.');

    return (
        <div className="flex w-80 flex-col items-start gap-2">
            <Button variant="primary" disabled={step.busy} onClick={() => void step.run(publish)}>
                {step.busy ? 'Publishing...' : 'Publish'}
            </Button>
            {step.failure !== null && <FormError>{step.failure}</FormError>}
        </div>
    );
}
