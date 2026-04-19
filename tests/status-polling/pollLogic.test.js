const fc = require('fast-check');
const { evaluatePollState, processPollingSequence } = require('./pollLogic');

/**
 * Property-based tests for polling logic.
 *
 * **Validates: Requirements 7.2, 7.4, 7.5**
 *
 * Property 3 from design doc:
 * For any polling sequence, polling SHALL terminate when:
 *   (a) the session status is `completed` or `failed`, OR
 *   (b) 10 minutes have elapsed since polling started, OR
 *   (c) the user navigates away from the Contact detail page.
 * Polling SHALL NOT continue indefinitely.
 */

// --- Arbitraries ---

const terminalStatusArb = fc.constantFrom('completed', 'failed');
const runningStatusArb = fc.constant('running');
const elapsedMsArb = fc.integer({ min: 0, max: 1200000 }); // 0 to 20 min
const timeoutMsArb = fc.integer({ min: 1000, max: 600000 }); // 1s to 10min

// Generate a poll sequence that eventually terminates via terminal status
const terminatingSequenceArb = fc.tuple(
    fc.array(fc.record({
        status: runningStatusArb,
        elapsedMs: fc.integer({ min: 0, max: 599999 }),
    }), { minLength: 0, maxLength: 20 }),
    fc.record({
        status: terminalStatusArb,
        elapsedMs: fc.integer({ min: 0, max: 599999 }),
    })
).map(([running, terminal]) => [...running, terminal]);

// Generate a poll sequence of all 'running' with elapsed times below timeout
const allRunningSequenceArb = fc.array(fc.record({
    status: runningStatusArb,
    elapsedMs: fc.integer({ min: 0, max: 599999 }),
}), { minLength: 1, maxLength: 20 });

// --- Tests ---

describe('evaluatePollState - Property 3: Polling Termination', () => {

    it('terminal status (completed or failed) always stops polling', () => {
        fc.assert(
            fc.property(terminalStatusArb, elapsedMsArb, fc.boolean(), timeoutMsArb,
                (status, elapsedMs, navigatedAway, timeoutMs) => {
                    const result = evaluatePollState(status, elapsedMs, navigatedAway, timeoutMs);
                    expect(result.shouldContinue).toBe(false);
                    expect(result.reason).toBe('terminal_status');
                }
            )
        );
    });

    it('timeout always stops polling and marks as Failed', () => {
        fc.assert(
            fc.property(timeoutMsArb, fc.boolean(), (timeoutMs, navigatedAway) => {
                // elapsedMs >= timeoutMs, status is 'running'
                const elapsedMs = timeoutMs + fc.sample(fc.integer({ min: 0, max: 600000 }), 1)[0];
                const result = evaluatePollState('running', elapsedMs, navigatedAway, timeoutMs);
                expect(result.shouldContinue).toBe(false);
                // Either timeout or navigated_away (both stop polling)
                expect(['timeout', 'navigated_away']).toContain(result.reason);
            })
        );
    });

    it('user navigation away always stops polling (when status is running and not timed out)', () => {
        fc.assert(
            fc.property(timeoutMsArb, (timeoutMs) => {
                // elapsedMs < timeoutMs, status is 'running', navigatedAway is true
                const elapsedMs = Math.max(0, timeoutMs - 1);
                const result = evaluatePollState('running', elapsedMs, true, timeoutMs);
                expect(result.shouldContinue).toBe(false);
                expect(result.reason).toBe('navigated_away');
                expect(result.newStatus).toBeNull();
            })
        );
    });

    it('running status with no timeout and no navigation continues polling', () => {
        fc.assert(
            fc.property(timeoutMsArb, (timeoutMs) => {
                // elapsedMs < timeoutMs, status is 'running', navigatedAway is false
                const elapsedMs = Math.max(0, timeoutMs - 1);
                const result = evaluatePollState('running', elapsedMs, false, timeoutMs);
                expect(result.shouldContinue).toBe(true);
                expect(result.reason).toBe('running');
                expect(result.newStatus).toBeNull();
            })
        );
    });

    it('timeout produces Failed status', () => {
        fc.assert(
            fc.property(timeoutMsArb, (timeoutMs) => {
                const result = evaluatePollState('running', timeoutMs, false, timeoutMs);
                expect(result.shouldContinue).toBe(false);
                expect(result.reason).toBe('timeout');
                expect(result.newStatus).toBe('Failed');
            })
        );
    });

    it('terminal completed produces Completed status', () => {
        fc.assert(
            fc.property(elapsedMsArb, fc.boolean(), timeoutMsArb,
                (elapsedMs, navigatedAway, timeoutMs) => {
                    const result = evaluatePollState('completed', elapsedMs, navigatedAway, timeoutMs);
                    expect(result.newStatus).toBe('Completed');
                }
            )
        );
    });

    it('terminal failed produces Failed status', () => {
        fc.assert(
            fc.property(elapsedMsArb, fc.boolean(), timeoutMsArb,
                (elapsedMs, navigatedAway, timeoutMs) => {
                    const result = evaluatePollState('failed', elapsedMs, navigatedAway, timeoutMs);
                    expect(result.newStatus).toBe('Failed');
                }
            )
        );
    });
});

describe('processPollingSequence - Property 3: Polling Termination', () => {

    it('polling never continues after a terminal status in a sequence', () => {
        fc.assert(
            fc.property(terminatingSequenceArb, timeoutMsArb, (sequence, timeoutMs) => {
                const result = processPollingSequence(sequence, timeoutMs);
                // Must terminate because the sequence contains a terminal status
                expect(result.terminated).toBe(true);
                // pollCount must be <= sequence length (stopped at or before the terminal entry)
                expect(result.pollCount).toBeLessThanOrEqual(sequence.length);
                expect(result.pollCount).toBeGreaterThanOrEqual(1);
            })
        );
    });

    it('any finite sequence with eventual terminal status terminates', () => {
        fc.assert(
            fc.property(terminatingSequenceArb, (sequence) => {
                const result = processPollingSequence(sequence, 600000);
                expect(result.terminated).toBe(true);
                expect(result.terminationReason).not.toBeNull();
                expect(result.finalStatus).not.toBeNull();
            })
        );
    });

    it('polling sequence with all running and no timeout does not terminate', () => {
        fc.assert(
            fc.property(allRunningSequenceArb, (sequence) => {
                // Use a very large timeout so no entry triggers it
                const result = processPollingSequence(sequence, 1200000);
                expect(result.terminated).toBe(false);
                expect(result.terminationReason).toBeNull();
                expect(result.finalStatus).toBeNull();
                expect(result.pollCount).toBe(sequence.length);
            })
        );
    });
});
