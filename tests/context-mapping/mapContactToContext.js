/**
 * Maps Contact, Account, and Opportunity data to A2A simulation context.
 *
 * @param {Object} contact - Contact entity data (name, title)
 * @param {Object|null} account - Account entity data (name, industry) or null
 * @param {Object|null} opportunity - Opportunity entity data (amount, stage) or null
 * @returns {Object} A2A context object
 */
function mapContactToContext(contact, account, opportunity) {
    return {
        contact_name: (contact && contact.name) || '',
        company: (account && account.name) || '',
        role: (contact && contact.title) || '',
        industry: (account && account.industry) || '',
        deal_value: (opportunity && opportunity.amount != null) ? opportunity.amount : null,
        deal_stage: (opportunity && opportunity.stage) || null,
    };
}

module.exports = { mapContactToContext };
