/**
 * Checks if any simulation in the collection has status "Running".
 *
 * @param {Array<{status: string}>} simulations - Array of simulation records
 * @returns {boolean} True if any simulation has status "Running"
 */
function hasRunningSimulation(simulations) {
    if (!Array.isArray(simulations)) {
        return false;
    }

    for (var i = 0; i < simulations.length; i++) {
        if (simulations[i] && simulations[i].status === 'Running') {
            return true;
        }
    }

    return false;
}

/**
 * Determines the button state based on simulation records.
 *
 * @param {Array<{status: string}>} simulations - Array of simulation records
 * @returns {{ disabled: boolean, tooltip: string }}
 */
function getButtonState(simulations) {
    var running = hasRunningSimulation(simulations);

    return {
        disabled: running,
        tooltip: running
            ? 'A simulation is already running for this contact. Wait for it to complete or cancel it.'
            : 'Run Simulation',
    };
}

module.exports = { hasRunningSimulation, getButtonState };
