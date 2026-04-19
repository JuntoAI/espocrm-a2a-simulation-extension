/**
 * Formats elapsed time between a start timestamp and current time.
 *
 * @param {string|null} createdAt - ISO datetime string of simulation creation
 * @param {number} nowMs - Current time in milliseconds (Date.now())
 * @returns {string} Formatted elapsed time (e.g., "2m 34s")
 */
function formatElapsed(createdAt, nowMs) {
    if (!createdAt) {
        return '0m 00s';
    }

    var start = new Date(createdAt).getTime();

    if (isNaN(start)) {
        return '0m 00s';
    }

    var diff = Math.floor((nowMs - start) / 1000);

    if (diff < 0) {
        diff = 0;
    }

    var minutes = Math.floor(diff / 60);
    var seconds = diff % 60;

    return minutes + 'm ' + (seconds < 10 ? '0' : '') + seconds + 's';
}

/**
 * Determines if the elapsed timer should be active.
 *
 * @param {string} status - Simulation status ('Running', 'Completed', 'Failed')
 * @returns {boolean} Whether the timer should be ticking
 */
function shouldTimerBeActive(status) {
    return status === 'Running';
}

module.exports = { formatElapsed, shouldTimerBeActive };
