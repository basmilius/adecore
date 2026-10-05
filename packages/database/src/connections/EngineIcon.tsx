import type { Ref } from 'react';

import { Icon } from '@adecore/ui';
import type { Engine } from '../protocol/index.ts';
import { ENGINE_ICONS } from './engine-icons.ts';

export interface EngineIconProps {
    engine: Engine;
    /* 12, 14, 16 or 20. */
    size?: number;
    className?: string;
    ref?: Ref<SVGSVGElement>;
}

/* A file on disk for SQLite, a server for MySQL and MariaDB. */
export function EngineIcon({ engine, size = 16, className, ref }: EngineIconProps) {
    return <Icon ref={ref} icon={ENGINE_ICONS[engine]} size={size} className={className} />;
}
