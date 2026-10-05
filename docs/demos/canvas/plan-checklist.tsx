import { useState } from 'react';
import { Bot, User } from 'lucide-react';
import { applyPlanOps, createPlan, effectiveChecks, isParentStep, planProgress, planToMarkdown, progressText, stepState, type PlanDraft } from '@adecore/plan';
import type { Plan, PlanActor, PlanItem, PlanOp, PlanStep } from '@adecore/plan/protocol';
import { Button, Checkbox, Segmented } from '@adecore/ui';

const DRAFT: PlanDraft = {
    meta: { title: 'Ship the release' },
    items: [
        {
            type: 'section',
            id: 'prepare',
            title: 'Prepare',
            items: [
                { type: 'step', id: 'changelog', title: 'Write the changelog', state: 'done' },
                {
                    type: 'step',
                    id: 'checks',
                    title: 'Run the checks',
                    steps: [
                        { type: 'step', id: 'typecheck', title: 'Typecheck', checks: 'agent', state: 'done' },
                        { type: 'step', id: 'tests', title: 'Tests', checks: 'agent', state: 'active' }
                    ]
                }
            ]
        },
        {
            type: 'section',
            id: 'release',
            title: 'Release',
            items: [
                { type: 'text', id: 'heads-up', title: 'Heads-up', description: 'A published version cannot be taken back.' },
                { type: 'step', id: 'approve', title: 'Approve the release', checks: 'person' },
                { type: 'step', id: 'publish', title: 'Publish to npm' }
            ]
        }
    ]
};

function initialPlan(): Plan {
    const created = createPlan(DRAFT, { id: 'release', now: '2026-10-05T09:00:00.000Z' });
    if (!created.ok) {
        throw new Error(created.message);
    }
    return created.plan;
}

export default function PlanChecklistDemo() {
    const [plan, setPlan] = useState<Plan>(initialPlan);
    const [actor, setActor] = useState<PlanActor>('person');
    const [refusal, setRefusal] = useState<string | null>(null);

    function apply(ops: PlanOp[]) {
        const result = applyPlanOps(plan, ops, { actor, now: new Date().toISOString() });
        if (result.ok) {
            setPlan(result.plan);
            setRefusal(null);
        } else {
            setRefusal(`${result.code}: ${result.message}`);
        }
    }

    function stepRow(step: PlanStep, depth: number) {
        const checks = effectiveChecks(plan, step);
        const tags = [
            stepState(step),
            ...(checks === 'anyone' ? [] : [`${checks} only`]),
            ...(step.unlocked ? ['unlocked'] : []),
            ...(step.by === 'person' ? ['set by a person'] : [])
        ];
        const progress = planProgress(step.steps ?? []);
        return (
            <li key={step.id} className="flex flex-col gap-1.5" style={{ paddingLeft: depth * 24 }}>
                <label className="flex items-center gap-2">
                    {isParentStep(step) ? (
                        <span className="text-text-muted">{`${progress.finished}/${progress.total}`}</span>
                    ) : (
                        <Checkbox
                            label={step.title}
                            checked={stepState(step) === 'done'}
                            onCheckedChange={(checked) => apply([{ op: 'set', ids: [step.id], state: checked ? 'done' : 'open' }])}
                        />
                    )}
                    <span>{step.title}</span>
                    <span className="text-text-muted">{tags.join(', ')}</span>
                </label>
                {step.steps && <ul className="flex flex-col gap-1.5">{step.steps.map((child) => stepRow(child, depth + 1))}</ul>}
            </li>
        );
    }

    function itemRow(item: PlanItem) {
        if (item.type === 'step') {
            return stepRow(item, 0);
        }
        if (item.type === 'text') {
            return (
                <li key={item.id} className="text-text-muted">
                    <strong className="text-text">{item.title}</strong> {item.description}
                </li>
            );
        }
        return (
            <li key={item.id} className="flex flex-col gap-1.5">
                <span className="font-medium">{item.title}</span>
                <ul className="flex flex-col gap-1.5">{item.items.map(itemRow)}</ul>
            </li>
        );
    }

    return (
        <div className="flex w-full flex-col gap-4 text-sm text-text">
            <div className="flex items-center gap-2">
                <Segmented<PlanActor>
                    label="Acting as"
                    value={actor}
                    onValueChange={setActor}
                    options={[
                        { id: 'person', label: 'Person', icon: User },
                        { id: 'agent', label: 'Agent', icon: Bot }
                    ]}
                />
                <Button size="sm" variant="secondary" onClick={() => apply([{ op: 'unlock', ids: 'all' }])}>
                    Unlock all
                </Button>
            </div>
            <ul className="flex flex-col gap-3">{plan.items.map(itemRow)}</ul>
            <p className="text-text-muted">
                {progressText(plan)}, rev {plan.rev}
            </p>
            {refusal && <p className="text-status-error">{refusal}</p>}
            <pre className="overflow-x-auto rounded-md bg-surface-sunken p-3 font-mono text-code text-text-muted">{planToMarkdown(plan)}</pre>
        </div>
    );
}
