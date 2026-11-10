import { Avatar } from '@adecore/ui';

export default function AvatarDemo() {
    return (
        <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
                <Avatar name="Sanne de Vries" size="lg" />
                <Avatar name="Sanne de Vries" />
                <Avatar name="Sanne de Vries" size="sm" />
                <Avatar name="mama" />
            </div>
            <div className="flex items-center gap-2.5">
                <Avatar name="Jan Dekker" aria-hidden />
                <span className="flex flex-col">
                    <span className="text-sm font-semibold">Jan Dekker</span>
                    <span className="text-xs text-text-muted">to me · 09:41</span>
                </span>
            </div>
        </div>
    );
}
