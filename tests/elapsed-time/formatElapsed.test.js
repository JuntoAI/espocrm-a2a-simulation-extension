const fc = require('fast-check');
const { formatElapsed, shouldTimerBeActive } = require('./formatElapsed');

/**
 * Property-based tests for elapsed time display.
 *
 * **Validates: Requirement 4.7**
 *
 * Property 7 from design doc:
 * For any simulation with status "Running" and a known createdAt timestamp,
 * the displayed elapsed time SHALL equal the difference between the current
 * time and createdAt, updated every second. The elapsed time SHALL stop
 * updating when the simulation transitions to "Completed" or "Failed".
 */

// --- Arbitraries ---

const now = Date.now();

// Generate timestamps within a reasonable range (past year)
const timestampArb = fc.integer({ min: now - 365 * 24 * 60 * 60 * 1000, max: now });
const nowMsArb = fc.integer({ min: now - 1000, max: now + 365 * 24 * 60 * 60 * 1000 });
const diffSecondsArb = fc.integer({ min: 0, max: 36000 }); // 0 to 10 hours
const statusArb = fc.constantFrom('Running', 'Completed', 'Failed');

// --- Tests ---

describe('formatElapsed - Property 7: Running State Elapsed Time Accuracy', () => {

    it('elapsed time matches wall clock difference (minutes and seconds)', () => {
        fc.assert(
            fc.property(diffSecondsArb, (diffSeconds) => {
                const startMs = now - diffSeconds * 1000;
                const createdAt = new Date(startMs).toISOString();
                const result = formatElapsed(createdAt, now);

                const expectedMinutes = Math.floor(diffSeconds / 60);
                const expectedSeconds = diffSeconds % 60;
                const expected = expectedMinutes + 'm ' + (expectedSeconds < 10 ? '0' : '') + expectedSeconds + 's';

                expect(result).toBe(expected);
            }),
            { numRuns: 200 }
        );
    });

    it('negative time differences clamp to 0', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 365 * 24 * 60 * 60 * 1000 }),
                (futureOffsetMs) => {
                    // createdAt is in the future relative to nowMs
                    const futureMs = now + futureOffsetMs;
                    const createdAt = new Date(futureMs).toISOString();
                    const result = formatElapsed(createdAt, now);

                    expect(result).toBe('0m 00s');
                }
            ),
            { numRuns: 100 }
        );
    });

    it('null/invalid createdAt returns "0m 00s"', () => {
        fc.assert(
            fc.property(nowMsArb, (nowMs) => {
                expect(formatElapsed(null, nowMs)).toBe('0m 00s');
                expect(formatElapsed(undefined, nowMs)).toBe('0m 00s');
                expect(formatElapsed('', nowMs)).toBe('0m 00s');
                expect(formatElapsed('not-a-date', nowMs)).toBe('0m 00s');
                expect(formatElapsed('abc123', nowMs)).toBe('0m 00s');
            }),
            { numRuns: 100 }
        );
    });

    it('seconds are always zero-padded to 2 digits', () => {
        fc.assert(
            fc.property(diffSecondsArb, (diffSeconds) => {
                const startMs = now - diffSeconds * 1000;
                const createdAt = new Date(startMs).toISOString();
                const result = formatElapsed(createdAt, now);

                // Extract seconds part after "m "
                const secondsPart = result.split('m ')[1];
                // Remove trailing 's'
                const secondsStr = secondsPart.replace('s', '');

                expect(secondsStr.length).toBe(2);
            }),
            { numRuns: 200 }
        );
    });

    it('format is always "{N}m {SS}s"', () => {
        fc.assert(
            fc.property(diffSecondsArb, (diffSeconds) => {
                const startMs = now - diffSeconds * 1000;
                const createdAt = new Date(startMs).toISOString();
                const result = formatElapsed(createdAt, now);

                // Match pattern: digits + "m " + exactly 2 digits + "s"
                expect(result).toMatch(/^\d+m \d{2}s$/);
            }),
            { numRuns: 200 }
        );
    });

    it('timer is active only when status is "Running"', () => {
        fc.assert(
            fc.property(statusArb, (status) => {
                if (status === 'Running') {
                    expect(shouldTimerBeActive(status)).toBe(true);
                } else {
                    expect(shouldTimerBeActive(status)).toBe(false);
                }
            }),
            { numRuns: 100 }
        );
    });

    it('timer is inactive for "Completed" status', () => {
        expect(shouldTimerBeActive('Completed')).toBe(false);
    });

    it('timer is inactive for "Failed" status', () => {
        expect(shouldTimerBeActive('Failed')).toBe(false);
    });

    it('large time differences (hours) are correctly formatted as minutes', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 3600, max: 36000 }), // 1 hour to 10 hours in seconds
                (diffSeconds) => {
                    const startMs = now - diffSeconds * 1000;
                    const createdAt = new Date(startMs).toISOString();
                    const result = formatElapsed(createdAt, now);

                    const expectedMinutes = Math.floor(diffSeconds / 60);
                    const expectedSeconds = diffSeconds % 60;
                    const expected = expectedMinutes + 'm ' + (expectedSeconds < 10 ? '0' : '') + expectedSeconds + 's';

                    expect(result).toBe(expected);
                    // Minutes should be >= 60 for hour+ durations
                    const minutesPart = parseInt(result.split('m')[0], 10);
                    expect(minutesPart).toBeGreaterThanOrEqual(60);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('exact minute boundaries produce "Xm 00s"', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 600 }), // 0 to 600 minutes
                (minutes) => {
                    const diffSeconds = minutes * 60;
                    const startMs = now - diffSeconds * 1000;
                    const createdAt = new Date(startMs).toISOString();
                    const result = formatElapsed(createdAt, now);

                    expect(result).toBe(minutes + 'm 00s');
                }
            ),
            { numRuns: 200 }
        );
    });
});
