/**
 * Validates a simulation trigger request.
 *
 * @param {Object} request - The request object
 * @param {string} request.scenarioId - Scenario identifier (required, non-empty string)
 * @param {Object} request.context - Context data (required, non-null object)
 * @param {string[]} requiredContextFields - List of required context field names
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateSimulationRequest(request, requiredContextFields) {
    var errors = [];

    // scenarioId must be a non-empty string
    if (!request || typeof request.scenarioId !== 'string' || request.scenarioId.trim() === '') {
        errors.push('scenarioId is required and must be a non-empty string.');
    }

    // context must be a non-null object
    if (!request || request.context === null || request.context === undefined || typeof request.context !== 'object' || Array.isArray(request.context)) {
        errors.push('context is required and must be an object.');
    } else {
        // Check required context fields
        for (var i = 0; i < requiredContextFields.length; i++) {
            var field = requiredContextFields[i];
            if (!Object.prototype.hasOwnProperty.call(request.context, field)) {
                errors.push('Required context field "' + field + '" is missing or empty.');
            } else {
                var val = request.context[field];
                if (val === null || val === undefined || (typeof val === 'string' && val.trim() === '')) {
                    errors.push('Required context field "' + field + '" is missing or empty.');
                }
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors: errors,
    };
}

module.exports = { validateSimulationRequest };
