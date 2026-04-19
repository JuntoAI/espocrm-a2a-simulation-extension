/**
 * Pure functions for determining polling behavior.
 *
 * Extracted from the frontend polling logic so it can be tested
 * with property-based tests (fast-check) without browser dependencies.
 */

/**
 * Determines whether polling should continue or stop.
 *
 * @param {string} currentStatus - Current session status from A2A API ('running', 'completed', 'failed')
 * @param {number} elapsedMs - Milliseconds since polling started
 * @param {boolean} userNavigatedAway - Whether user left the Contact detail page
 * @param {number} timeoutMs - Maximum polling duration in ms (default: 600000 = 10 min)
 * @returns {{ shouldContinue: boolean, reason: string, newStatus: string|null }}
 */
function evaluatePollState(currentStatus, elapsedMs, userNavigatedAway, timeoutMs) {
    timeoutMs = timeoutMs || 600000;

    // Condition (a): completed or failed → stop
    if (currentStatus === 'completed' || currentStatus === 'failed') {
        return {
            shouldContinue: false,
            reason: 'terminal_status',
            newStatus: currentStatus === 'completed' ? 'Completed' : 'Failed',
        };
    }

    // Condition (b): timeout → stop and mark as Failed
    if (elapsedMs >= timeoutMs) {
        return {
            shouldContinue: false,
            reason: 'timeout',
            newStatus: 'Failed',
        };
    }

    // Condition (c): user navigated away → stop
    if (userNavigatedAway) {
        return {
            shouldContinue: false,
            reason: 'navigated_away',
            newStatus: null,
        };
    }

    // Still running → continue polling
    return {
        shouldContinue: true,
        reason: 'running',
        newStatus: null,
    };
}

/**
 * Processes a sequence of poll responses and returns the final state.
 * Simulates the full polling lifecycle.
 *
 * @param {Array<{status: string, elapsedMs: number}>} pollSequence - Sequence of poll results
 * @param {number} timeoutMs - Timeout in ms
 * @returns {{ terminated: boolean, terminationReason: string|null, pollCount: number, finalStatus: string|null }}
 */
function processPollingSequence(pollSequence, timeoutMs) {
    timeoutMs = timeoutMs || 600000;
    var pollCount = 0;

    for (var i = 0; i < pollSequence.length; i++) {
        pollCount++;
        var poll = pollSequence[i];
        var result = evaluatePollState(poll.status, poll.elapsedMs, false, timeoutMs);

        if (!result.shouldContinue) {
            return {
                terminated: true,
                terminationReason: result.reason,
                pollCount: pollCount,
                finalStatus: result.newStatus,
            };
        }
    }

    return {
        terminated: false,
        terminationReason: null,
        pollCount: pollCount,
        finalStatus: null,
    };
}

module.exports = { evaluatePollState, processPollingSequence };
