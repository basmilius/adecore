import { HardDrive, Server, type LucideIcon } from 'lucide-react';
import type { Engine } from '../protocol/index.ts';

/* A file on disk for SQLite, a server for MySQL and MariaDB. */
export const ENGINE_ICONS: Record<Engine, LucideIcon> = { sqlite: HardDrive, mysql: Server };
