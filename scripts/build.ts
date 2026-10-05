import { spawnSync } from 'node:child_process';
import { dependencyOrder, discoverPackages } from './workspaces.ts';

for (const pkg of dependencyOrder(discoverPackages(), true)) {
    if (!pkg.manifest.scripts?.build) {
        continue;
    }
    console.log(`Building ${pkg.manifest.name}`);
    const result = spawnSync(process.execPath, ['run', 'build'], { cwd: pkg.directory, stdio: 'inherit' });
    if (result.status !== 0) {
        throw new Error(`Build failed for ${pkg.manifest.name}: ${result.error?.message ?? result.status}.`);
    }
}
