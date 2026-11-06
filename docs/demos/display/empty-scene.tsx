import { Button, EmptyScene, EmptyState } from '@adecore/ui';

export default function EmptySceneDemo() {
    return (
        <EmptyState
            scene={
                <EmptyScene>
                    <g className="scene-loop">
                        <g className="scene-lift">
                            <rect className="scene-shape" x="30" y="8" width="100" height="88" rx="10" />
                        </g>
                        <path className="scene-text scene-type-1" pathLength={1} d="M48 30h64" />
                        <path className="scene-text scene-type-3" pathLength={1} d="M48 50h48" />
                        <circle className="scene-accent scene-reveal-6" cx="104" cy="74" r="8" />
                    </g>
                </EmptyScene>
            }
            title="No tasks yet"
            action={
                <Button variant="secondary" size="sm">
                    Create a task
                </Button>
            }
            className="w-full max-w-md rounded-lg border border-border bg-surface"
        >
            A task you create shows up here.
        </EmptyState>
    );
}
