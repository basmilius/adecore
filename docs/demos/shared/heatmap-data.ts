/* Data for the heatmap demos: made up, seeded, so every render draws the same. */

function noise(seed: number): number {
    const value = Math.sin(seed * 78.233) * 43758.5453;

    return value - Math.floor(value);
}

/*
 * Events per weekday (Monday first) and hour, summed over four weeks: busy in working hours, a burst on Monday morning,
 * a nightly job at three, and quiet weekend nights with no events at all.
 */
export function eventsPerWeekdayAndHour(): number[][] {
    const grid = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));

    for (let week = 0; week < 4; week++) {
        for (let day = 0; day < 7; day++) {
            const weekend = day >= 5;

            for (let hour = 0; hour < 24; hour++) {
                const seed = week * 1000 + day * 24 + hour;
                const working = hour >= 8 && hour <= 18 ? Math.sin(((hour - 8) / 10) * Math.PI) : 0;
                let rate = weekend ? working * 1.5 : 2 + working * 9;

                if (day === 0 && hour >= 9 && hour <= 10) {
                    rate += 14;
                }

                if (hour === 3) {
                    rate += 4;
                }

                if (weekend && (hour < 8 || hour > 21) && hour !== 3) {
                    rate = 0;
                }
                grid[day]![hour]! += Math.round(rate * (0.6 + noise(seed) * 0.8));
            }
        }
    }

    return grid;
}

export const SUITES = ['Editor', 'Terminal', 'Database', 'Agents', 'Settings'];
export const PLATFORMS = ['macOS arm64', 'macOS x64', 'Windows', 'Linux', 'Linux arm64'];

/* Failed checks per suite and platform over the last 50 runs; `null` where a suite does not run on a platform. */
export function failuresPerSuiteAndPlatform(): (number | null)[][] {
    return SUITES.map((_, suite) =>
        PLATFORMS.map((platform, index) => {
            if (suite === 2 && platform === 'Linux arm64') {
                return null;
            }

            const flaky = suite === 1 && index === 2 ? 6 : 0;

            return Math.max(0, Math.round(noise(suite * 10 + index + 3) * 10 - 2) + flaky);
        })
    );
}
