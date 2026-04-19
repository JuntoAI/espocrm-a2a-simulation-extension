const fc = require('fast-check');
const { mapContactToContext } = require('./mapContactToContext');

/**
 * Property-based tests for context mapping function.
 *
 * **Validates: Requirements 5.4**
 *
 * Property 1 from design doc:
 * For any Contact record with associated Account and Opportunity, the context
 * mapping function SHALL produce an object where:
 * - contact_name equals the Contact's name
 * - company equals the Account's name (or empty string if no Account)
 * - role equals the Contact's title (or empty string)
 * - industry equals the Account's industry (or empty string)
 * - deal_value/deal_stage equal the Opportunity's amount/stage (or null if no Opportunity)
 */

// --- Arbitraries ---

const contactArb = fc.record({
    name: fc.string({ minLength: 0, maxLength: 100 }),
    title: fc.string({ minLength: 0, maxLength: 100 }),
});

const accountArb = fc.option(fc.record({
    name: fc.string({ minLength: 0, maxLength: 100 }),
    industry: fc.string({ minLength: 0, maxLength: 50 }),
}), { nil: null });

const opportunityArb = fc.option(fc.record({
    amount: fc.oneof(fc.integer({ min: 0, max: 10000000 }), fc.float({ min: 0, max: 10000000, noNaN: true })),
    stage: fc.constantFrom('Prospecting', 'Qualification', 'Needs Analysis', 'Value Proposition', 'Proposal/Price Quote', 'Closed Won', 'Closed Lost'),
}), { nil: null });

// --- Tests ---

describe('mapContactToContext - Property 1: Context Mapping Completeness', () => {

    it('output always has exactly the 6 expected keys', () => {
        fc.assert(
            fc.property(contactArb, accountArb, opportunityArb, (contact, account, opportunity) => {
                const result = mapContactToContext(contact, account, opportunity);
                const keys = Object.keys(result).sort();
                expect(keys).toEqual(['company', 'contact_name', 'deal_stage', 'deal_value', 'industry', 'role']);
            })
        );
    });

    it('contact_name equals contact.name (or empty string if falsy)', () => {
        fc.assert(
            fc.property(contactArb, accountArb, opportunityArb, (contact, account, opportunity) => {
                const result = mapContactToContext(contact, account, opportunity);
                expect(result.contact_name).toBe(contact.name || '');
            })
        );
    });

    it('company equals account.name (or empty string if no account)', () => {
        fc.assert(
            fc.property(contactArb, accountArb, opportunityArb, (contact, account, opportunity) => {
                const result = mapContactToContext(contact, account, opportunity);
                if (account === null) {
                    expect(result.company).toBe('');
                } else {
                    expect(result.company).toBe(account.name || '');
                }
            })
        );
    });

    it('role equals contact.title (or empty string if falsy)', () => {
        fc.assert(
            fc.property(contactArb, accountArb, opportunityArb, (contact, account, opportunity) => {
                const result = mapContactToContext(contact, account, opportunity);
                expect(result.role).toBe(contact.title || '');
            })
        );
    });

    it('industry equals account.industry (or empty string if no account)', () => {
        fc.assert(
            fc.property(contactArb, accountArb, opportunityArb, (contact, account, opportunity) => {
                const result = mapContactToContext(contact, account, opportunity);
                if (account === null) {
                    expect(result.industry).toBe('');
                } else {
                    expect(result.industry).toBe(account.industry || '');
                }
            })
        );
    });

    it('deal_value equals opportunity.amount (or null if no opportunity)', () => {
        fc.assert(
            fc.property(contactArb, accountArb, opportunityArb, (contact, account, opportunity) => {
                const result = mapContactToContext(contact, account, opportunity);
                if (opportunity === null) {
                    expect(result.deal_value).toBeNull();
                } else {
                    expect(result.deal_value).toBe(opportunity.amount);
                }
            })
        );
    });

    it('deal_stage equals opportunity.stage (or null if no opportunity)', () => {
        fc.assert(
            fc.property(contactArb, accountArb, opportunityArb, (contact, account, opportunity) => {
                const result = mapContactToContext(contact, account, opportunity);
                if (opportunity === null) {
                    expect(result.deal_stage).toBeNull();
                } else {
                    expect(result.deal_stage).toBe(opportunity.stage || null);
                }
            })
        );
    });

    it('output never contains undefined values', () => {
        fc.assert(
            fc.property(contactArb, accountArb, opportunityArb, (contact, account, opportunity) => {
                const result = mapContactToContext(contact, account, opportunity);
                const values = Object.values(result);
                values.forEach(v => {
                    expect(v).not.toBeUndefined();
                });
            })
        );
    });

    it('with null contact, all string fields are empty strings', () => {
        fc.assert(
            fc.property(accountArb, opportunityArb, (account, opportunity) => {
                const result = mapContactToContext(null, account, opportunity);
                expect(result.contact_name).toBe('');
                expect(result.role).toBe('');
            })
        );
    });
});
