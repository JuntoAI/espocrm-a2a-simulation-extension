const fc = require('fast-check');
const { validateSimulationRequest } = require('./validateSimulationRequest');

/**
 * Property-based tests for simulation request validation.
 *
 * **Validates: Requirements 5.6, 10.2**
 *
 * Property 5 from design doc:
 * For any simulation trigger request, the request SHALL be rejected if: the scenario ID
 * is empty, any required context field for the selected scenario is empty, or the user
 * does not have create access to the A2ASimulation entity. Valid requests SHALL contain
 * a non-empty scenario ID and all required context fields.
 */

// --- Arbitraries ---

const validScenarioIdArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);
const invalidScenarioIdArb = fc.constantFrom('', '   ', null, undefined, 123, true);
const requiredFieldsArb = fc.array(
    fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0 && s !== '__proto__' && s !== 'constructor' && s !== 'toString' && s !== 'valueOf'),
    { minLength: 1, maxLength: 5 }
);

// Generates a context object where all required fields have non-empty values
const validContextArb = (requiredFields) =>
    fc.record(
        Object.fromEntries(
            requiredFields.map(field => [
                field,
                fc.oneof(
                    fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
                    fc.integer({ min: 1, max: 10000 })
                ),
            ])
        )
    );

// Generates extra fields that won't collide with required fields
const extraFieldsArb = fc.dictionary(
    fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[a-z]/.test(s) && s !== '__proto__' && s !== 'constructor' && s !== 'toString' && s !== 'valueOf'),
    fc.oneof(fc.string(), fc.integer(), fc.boolean()),
    { minKeys: 0, maxKeys: 5 }
);

// --- Tests ---

describe('validateSimulationRequest - Property 5: Simulation Request Validation', () => {

    it('valid requests (non-empty scenarioId + all required fields filled) always pass validation', () => {
        fc.assert(
            fc.property(validScenarioIdArb, requiredFieldsArb, (scenarioId, requiredFields) => {
                // Build a context with all required fields filled
                const context = {};
                requiredFields.forEach(field => {
                    context[field] = 'value_' + field;
                });

                const result = validateSimulationRequest(
                    { scenarioId, context },
                    requiredFields
                );

                expect(result.valid).toBe(true);
                expect(result.errors).toEqual([]);
            })
        );
    });

    it('empty/missing scenarioId always fails validation', () => {
        fc.assert(
            fc.property(invalidScenarioIdArb, (scenarioId) => {
                const request = { scenarioId, context: { someField: 'value' } };
                const result = validateSimulationRequest(request, []);

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('scenarioId is required and must be a non-empty string.');
            })
        );
    });

    it('missing required context fields always fails validation', () => {
        fc.assert(
            fc.property(validScenarioIdArb, requiredFieldsArb, (scenarioId, requiredFields) => {
                // Provide context with none of the required fields
                const context = { unrelatedField: 'hello' };

                const result = validateSimulationRequest(
                    { scenarioId, context },
                    requiredFields
                );

                expect(result.valid).toBe(false);
                // Should have one error per missing required field
                requiredFields.forEach(field => {
                    expect(result.errors).toContain(
                        'Required context field "' + field + '" is missing or empty.'
                    );
                });
            })
        );
    });

    it('null/undefined context always fails validation', () => {
        fc.assert(
            fc.property(
                validScenarioIdArb,
                fc.constantFrom(null, undefined),
                (scenarioId, context) => {
                    const result = validateSimulationRequest(
                        { scenarioId, context },
                        []
                    );

                    expect(result.valid).toBe(false);
                    expect(result.errors).toContain('context is required and must be an object.');
                }
            )
        );
    });

    it('array context always fails validation (must be object)', () => {
        fc.assert(
            fc.property(
                validScenarioIdArb,
                fc.array(fc.anything(), { minLength: 0, maxLength: 5 }),
                (scenarioId, context) => {
                    const result = validateSimulationRequest(
                        { scenarioId, context },
                        []
                    );

                    expect(result.valid).toBe(false);
                    expect(result.errors).toContain('context is required and must be an object.');
                }
            )
        );
    });

    it('extra context fields do not affect validation', () => {
        fc.assert(
            fc.property(
                validScenarioIdArb,
                requiredFieldsArb,
                extraFieldsArb,
                (scenarioId, requiredFields, extraFields) => {
                    // Build context with all required fields + extra fields
                    const context = {};
                    requiredFields.forEach(field => {
                        context[field] = 'valid_' + field;
                    });
                    // Add extra fields (filter out collisions with required fields)
                    Object.entries(extraFields).forEach(([key, val]) => {
                        if (!requiredFields.includes(key)) {
                            context[key] = val;
                        }
                    });

                    const result = validateSimulationRequest(
                        { scenarioId, context },
                        requiredFields
                    );

                    expect(result.valid).toBe(true);
                    expect(result.errors).toEqual([]);
                }
            )
        );
    });

    it('errors array is empty when valid is true', () => {
        fc.assert(
            fc.property(validScenarioIdArb, requiredFieldsArb, (scenarioId, requiredFields) => {
                const context = {};
                requiredFields.forEach(field => {
                    context[field] = 'filled_' + field;
                });

                const result = validateSimulationRequest(
                    { scenarioId, context },
                    requiredFields
                );

                if (result.valid) {
                    expect(result.errors).toEqual([]);
                }
            })
        );
    });

    it('errors array is non-empty when valid is false', () => {
        fc.assert(
            fc.property(invalidScenarioIdArb, (scenarioId) => {
                const result = validateSimulationRequest(
                    { scenarioId, context: {} },
                    []
                );

                if (!result.valid) {
                    expect(result.errors.length).toBeGreaterThan(0);
                }
            })
        );
    });
});
