const fc = require('fast-check');
const { hasRunningSimulation, getButtonState } = require('./hasRunningSimulation');

/**
 * Property-based tests for concurrent simulation prevention logic.
 *
 * **Validates: Requirements 4.10**
 *
 * Property 8 from design doc:
 * For any Contact with at least one A2ASimulation record in "Running" status,
 * the "Run Simulation" button SHALL be disabled. The button SHALL be re-enabled
 * only when zero simulations for that Contact have status "Running".
 */

// --- Arbitraries ---

const statusArb = fc.constantFrom('Running', 'Completed', 'Failed');
const nonRunningStatusArb = fc.constantFrom('Completed', 'Failed');
const simulationArb = fc.record({ status: statusArb });
const nonRunningSimulationArb = fc.record({ status: nonRunningStatusArb });
const runningSimulationArb = fc.constant({ status: 'Running' });

// Array with at least one Running
const withRunningArb = fc.tuple(
    fc.array(simulationArb, { minLength: 0, maxLength: 10 }),
    runningSimulationArb,
    fc.array(simulationArb, { minLength: 0, maxLength: 10 })
).map(([before, running, after]) => [...before, running, ...after]);

// Array with no Running
const withoutRunningArb = fc.array(nonRunningSimulationArb, { minLength: 0, maxLength: 20 });

// --- Tests ---

describe('hasRunningSimulation / getButtonState - Property 8: Concurrent Simulation Prevention', () => {

    it('empty array → button enabled', () => {
        const state = getButtonState([]);
        expect(state.disabled).toBe(false);
        expect(hasRunningSimulation([])).toBe(false);
    });

    it('all Completed/Failed → button enabled', () => {
        fc.assert(
            fc.property(
                fc.array(nonRunningSimulationArb, { minLength: 1, maxLength: 20 }),
                (simulations) => {
                    expect(hasRunningSimulation(simulations)).toBe(false);
                    const state = getButtonState(simulations);
                    expect(state.disabled).toBe(false);
                }
            ),
            { numRuns: 200 }
        );
    });

    it('at least one Running → button disabled', () => {
        fc.assert(
            fc.property(withRunningArb, (simulations) => {
                expect(hasRunningSimulation(simulations)).toBe(true);
                const state = getButtonState(simulations);
                expect(state.disabled).toBe(true);
            }),
            { numRuns: 200 }
        );
    });

    it('exactly one Running among many non-running → button disabled', () => {
        fc.assert(
            fc.property(
                fc.array(nonRunningSimulationArb, { minLength: 0, maxLength: 10 }),
                fc.array(nonRunningSimulationArb, { minLength: 0, maxLength: 10 }),
                (before, after) => {
                    const simulations = [...before, { status: 'Running' }, ...after];
                    expect(hasRunningSimulation(simulations)).toBe(true);
                    const state = getButtonState(simulations);
                    expect(state.disabled).toBe(true);
                }
            ),
            { numRuns: 200 }
        );
    });

    it('all Running → button disabled', () => {
        fc.assert(
            fc.property(
                fc.array(runningSimulationArb, { minLength: 1, maxLength: 20 }),
                (simulations) => {
                    expect(hasRunningSimulation(simulations)).toBe(true);
                    const state = getButtonState(simulations);
                    expect(state.disabled).toBe(true);
                }
            ),
            { numRuns: 200 }
        );
    });

    it('non-array input → button enabled (defensive)', () => {
        fc.assert(
            fc.property(
                fc.oneof(
                    fc.constant(null),
                    fc.constant(undefined),
                    fc.string(),
                    fc.integer(),
                    fc.boolean(),
                    fc.constant({})
                ),
                (input) => {
                    expect(hasRunningSimulation(input)).toBe(false);
                    const state = getButtonState(input);
                    expect(state.disabled).toBe(false);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('button disabled iff hasRunningSimulation returns true (consistency)', () => {
        fc.assert(
            fc.property(
                fc.oneof(withRunningArb, withoutRunningArb, fc.constant([])),
                (simulations) => {
                    const running = hasRunningSimulation(simulations);
                    const state = getButtonState(simulations);
                    expect(state.disabled).toBe(running);
                }
            ),
            { numRuns: 200 }
        );
    });

    it('tooltip changes based on disabled state', () => {
        fc.assert(
            fc.property(
                fc.oneof(withRunningArb, withoutRunningArb, fc.constant([])),
                (simulations) => {
                    const state = getButtonState(simulations);
                    if (state.disabled) {
                        expect(state.tooltip).toBe(
                            'A simulation is already running for this contact. Wait for it to complete or cancel it.'
                        );
                    } else {
                        expect(state.tooltip).toBe('Run Simulation');
                    }
                }
            ),
            { numRuns: 200 }
        );
    });

    it('adding a Running simulation to a non-running set disables the button', () => {
        fc.assert(
            fc.property(withoutRunningArb, (nonRunning) => {
                // Before: no running → enabled
                expect(getButtonState(nonRunning).disabled).toBe(false);

                // After: add a Running → disabled
                const withRunning = [...nonRunning, { status: 'Running' }];
                expect(getButtonState(withRunning).disabled).toBe(true);
            }),
            { numRuns: 200 }
        );
    });

    it('removing the last Running simulation re-enables the button', () => {
        fc.assert(
            fc.property(
                fc.array(nonRunningSimulationArb, { minLength: 0, maxLength: 10 }),
                (nonRunning) => {
                    // With one Running → disabled
                    const withRunning = [...nonRunning, { status: 'Running' }];
                    expect(getButtonState(withRunning).disabled).toBe(true);

                    // Remove the Running entry → enabled
                    const withoutRunning = withRunning.filter(s => s.status !== 'Running');
                    expect(getButtonState(withoutRunning).disabled).toBe(false);
                }
            ),
            { numRuns: 200 }
        );
    });
});
