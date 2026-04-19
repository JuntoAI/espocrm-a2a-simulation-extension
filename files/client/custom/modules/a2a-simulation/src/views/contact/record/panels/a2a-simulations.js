/**
 * A2A Simulations Panel — Contact Detail View
 *
 * Displays simulation history for a Contact with live status updates.
 * Extends the standard EspoCRM relationship panel to show A2ASimulation
 * records with status badges, elapsed time counters, and polling logic.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10,
 *              7.1, 7.2, 7.3, 7.4, 7.5
 */
define('a2a-simulation:views/contact/record/panels/a2a-simulations', ['views/record/panels/relationship'], function (Dep) {

    var POLL_INTERVAL_MS = 10000;
    var ELAPSED_INTERVAL_MS = 1000;
    var TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

    return Dep.extend({

        name: 'a2aSimulations',

        entityType: 'A2ASimulation',

        link: 'a2aSimulations',

        scope: 'A2ASimulation',

        createDisabled: true,

        selectDisabled: true,

        rowActionsView: false,

        buttonList: [
            {
                action: 'runSimulation',
                title: 'Run Simulation',
                acl: 'create',
                aclScope: 'A2ASimulation',
                html: '<span class="fas fa-play"></span> Run Simulation',
            }
        ],

        /**
         * Polling and timer state.
         */
        _pollIntervalId: null,
        _elapsedIntervalId: null,
        _pollingSessions: null,
        _pollStartTimes: null,

        setup: function () {
            Dep.prototype.setup.call(this);

            this._pollingSessions = {};
            this._pollStartTimes = {};

            this.listenTo(this.collection, 'sync', function () {
                this._updateButtonState();
                this._evaluatePolling();
            }.bind(this));
        },

        afterRender: function () {
            Dep.prototype.afterRender.call(this);

            this._updateButtonState();
            this._renderStatusBadges();
            this._evaluatePolling();
        },

        onRemove: function () {
            this._stopAllPolling();
            this._stopElapsedTimer();

            if (Dep.prototype.onRemove) {
                Dep.prototype.onRemove.call(this);
            }
        },

        // ─── Run Simulation Action ─────────────────────────

        actionRunSimulation: function () {
            this.createView('runSimulationModal', 'a2a-simulation:views/a2a-simulation/modals/run-simulation', {
                model: this.model,
            }, function (view) {
                view.render();

                this.listenToOnce(view, 'simulation-started', function () {
                    this.collection.fetch();
                    this._startPolling();
                }, this);
            }.bind(this));
        },

        // ─── Button State (Concurrent Prevention) ──────────

        _updateButtonState: function () {
            var hasRunning = this._hasRunningSimulation();
            var $btn = this.$el.find('[data-action="runSimulation"]');

            if (!$btn.length) {
                return;
            }

            if (hasRunning) {
                $btn.prop('disabled', true).addClass('disabled');
                $btn.attr('title', 'A simulation is already running for this contact. Wait for it to complete or cancel it.');
            } else {
                $btn.prop('disabled', false).removeClass('disabled');
                $btn.attr('title', 'Run Simulation');
            }
        },

        _hasRunningSimulation: function () {
            if (!this.collection) {
                return false;
            }

            var models = this.collection.models || [];

            for (var i = 0; i < models.length; i++) {
                if (models[i].get('status') === 'Running') {
                    return true;
                }
            }

            return false;
        },

        // ─── Status Badges ─────────────────────────────────

        _renderStatusBadges: function () {
            var self = this;

            // Wait for list rows to render
            setTimeout(function () {
                self._applyBadges();
            }, 50);
        },

        _applyBadges: function () {
            var self = this;

            if (!this.collection) {
                return;
            }

            this.collection.models.forEach(function (model) {
                var status = model.get('status');
                var outcome = model.get('outcome');
                var $row = self.$el.find('tr[data-id="' + model.id + '"]');

                if (!$row.length) {
                    return;
                }

                // Find or create badge container in the status cell
                var $statusCell = $row.find('td[data-name="status"]');

                if (!$statusCell.length) {
                    // Try first cell as fallback
                    $statusCell = $row.find('td').first();
                }

                // Add badge class to row
                $row.removeClass('simulation-running simulation-completed-agreed simulation-completed-blocked simulation-completed-failed simulation-failed');

                if (status === 'Running') {
                    $row.addClass('simulation-running');
                    self._renderRunningIndicator($row, model);
                } else if (status === 'Completed') {
                    if (outcome === 'Agreed') {
                        $row.addClass('simulation-completed-agreed');
                    } else if (outcome === 'Blocked') {
                        $row.addClass('simulation-completed-blocked');
                    } else if (outcome === 'Failed') {
                        $row.addClass('simulation-completed-failed');
                    }
                } else if (status === 'Failed') {
                    $row.addClass('simulation-failed');
                }

                // Add viewer link
                var viewerUrl = model.get('viewerUrl');

                if (viewerUrl) {
                    self._renderViewerLink($row, viewerUrl);
                }
            });
        },

        _renderRunningIndicator: function ($row, model) {
            var $statusCell = $row.find('td[data-name="status"]');

            if (!$statusCell.length) {
                return;
            }

            var createdAt = model.get('createdAt');
            var turnsCompleted = model.get('turnsCompleted');
            var elapsed = this._formatElapsed(createdAt);
            var progressText = 'Running... ' + elapsed;

            if (turnsCompleted) {
                progressText += ' — Turn ' + turnsCompleted + ' of ~8';
            }

            var html = '<span class="simulation-status-running">' +
                '<span class="simulation-pulse-dot"></span> ' +
                '<span class="simulation-elapsed" data-session-id="' + (model.get('sessionId') || model.id) + '">' +
                    progressText +
                '</span>' +
            '</span>';

            $statusCell.html(html);
        },

        _renderViewerLink: function ($row, viewerUrl) {
            var $actionsCell = $row.find('td').last();

            if (!$actionsCell.length) {
                return;
            }

            // Only add if not already present
            if (!$actionsCell.find('.simulation-view-link').length) {
                $actionsCell.append(
                    ' <a href="' + this._escapeAttr(viewerUrl) + '" target="_blank" rel="noopener noreferrer" class="simulation-view-link">' +
                    '<span class="fas fa-external-link-alt"></span> View</a>'
                );
            }
        },

        // ─── Elapsed Time ──────────────────────────────────

        _startElapsedTimer: function () {
            if (this._elapsedIntervalId) {
                return;
            }

            var self = this;

            this._elapsedIntervalId = setInterval(function () {
                self._updateElapsedDisplays();
            }, ELAPSED_INTERVAL_MS);
        },

        _stopElapsedTimer: function () {
            if (this._elapsedIntervalId) {
                clearInterval(this._elapsedIntervalId);
                this._elapsedIntervalId = null;
            }
        },

        _updateElapsedDisplays: function () {
            var self = this;

            if (!this.collection) {
                return;
            }

            this.collection.models.forEach(function (model) {
                if (model.get('status') !== 'Running') {
                    return;
                }

                var createdAt = model.get('createdAt');
                var sessionId = model.get('sessionId') || model.id;
                var $elapsed = self.$el.find('.simulation-elapsed[data-session-id="' + sessionId + '"]');

                if (!$elapsed.length) {
                    return;
                }

                var elapsed = self._formatElapsed(createdAt);
                var turnsCompleted = model.get('turnsCompleted');
                var text = 'Running... ' + elapsed;

                if (turnsCompleted) {
                    text += ' — Turn ' + turnsCompleted + ' of ~8';
                }

                $elapsed.text(text);
            });
        },

        _formatElapsed: function (createdAt) {
            if (!createdAt) {
                return '0m 00s';
            }

            var start = new Date(createdAt).getTime();
            var now = Date.now();
            var diff = Math.floor((now - start) / 1000);

            if (diff < 0) {
                diff = 0;
            }

            var minutes = Math.floor(diff / 60);
            var seconds = diff % 60;

            return minutes + 'm ' + (seconds < 10 ? '0' : '') + seconds + 's';
        },

        // ─── Polling Logic ─────────────────────────────────

        _evaluatePolling: function () {
            var hasRunning = this._hasRunningSimulation();

            if (hasRunning) {
                this._startPolling();
                this._startElapsedTimer();
            } else {
                this._stopAllPolling();
                this._stopElapsedTimer();
            }
        },

        _startPolling: function () {
            if (this._pollIntervalId) {
                return;
            }

            var self = this;

            // Record poll start time for timeout tracking
            this.collection.models.forEach(function (model) {
                if (model.get('status') === 'Running') {
                    var sessionId = model.get('sessionId');

                    if (sessionId && !self._pollStartTimes[sessionId]) {
                        self._pollStartTimes[sessionId] = Date.now();
                    }
                }
            });

            this._pollIntervalId = setInterval(function () {
                self._pollRunningSessions();
            }, POLL_INTERVAL_MS);

            // Also start elapsed timer
            this._startElapsedTimer();
        },

        _stopAllPolling: function () {
            if (this._pollIntervalId) {
                clearInterval(this._pollIntervalId);
                this._pollIntervalId = null;
            }

            this._pollingSessions = {};
            this._pollStartTimes = {};
        },

        _pollRunningSessions: function () {
            var self = this;

            if (!this.collection) {
                return;
            }

            this.collection.models.forEach(function (model) {
                if (model.get('status') !== 'Running') {
                    return;
                }

                var sessionId = model.get('sessionId');

                if (!sessionId) {
                    return;
                }

                // Check timeout (10 minutes)
                var pollStart = self._pollStartTimes[sessionId] || Date.now();

                if (Date.now() - pollStart > TIMEOUT_MS) {
                    self._handleTimeout(model);
                    return;
                }

                // Skip if already polling this session
                if (self._pollingSessions[sessionId]) {
                    return;
                }

                self._pollingSessions[sessionId] = true;

                Espo.Ajax.getRequest('A2ASimulation/sessions/' + sessionId)
                    .then(function (response) {
                        delete self._pollingSessions[sessionId];
                        self._handlePollResponse(model, response);
                    })
                    .catch(function () {
                        delete self._pollingSessions[sessionId];
                    });
            });
        },

        _handlePollResponse: function (model, response) {
            var status = response.status;
            var turnsCompleted = response.turns_completed || response.turnsCompleted;

            // Update turn count on model for display
            if (turnsCompleted) {
                model.set('turnsCompleted', turnsCompleted);
            }

            if (status === 'completed' || status === 'failed') {
                // Update local model
                model.set('status', status === 'completed' ? 'Completed' : 'Failed');
                model.set('outcome', response.outcome || null);
                model.set('outcomeSummary', response.outcome_summary || response.outcomeSummary || null);
                model.set('viewerUrl', response.viewer_url || response.viewerUrl || null);

                if (turnsCompleted) {
                    model.set('turnsCompleted', turnsCompleted);
                }

                // Refresh the collection to get updated data
                this.collection.fetch();

                // Show completion notification
                this._showCompletionNotification(model);

                // Clean up polling for this session
                var sessionId = model.get('sessionId');
                delete this._pollStartTimes[sessionId];

                // Re-evaluate if we still need polling
                this._evaluatePolling();
            }
        },

        _handleTimeout: function (model) {
            var sessionId = model.get('sessionId');

            model.set('status', 'Failed');
            delete this._pollStartTimes[sessionId];

            // Refresh collection
            this.collection.fetch();

            Espo.Ui.notify(
                'Simulation taking longer than expected. Check the A2A dashboard.',
                'warning',
                0
            );

            this._evaluatePolling();
        },

        // ─── Completion Notification ───────────────────────

        _showCompletionNotification: function (model) {
            var name = model.get('name') || 'Simulation';
            var outcome = model.get('outcome');
            var status = model.get('status');
            var contactName = this.model.get('name') || 'Contact';
            var contactId = this.model.id;

            var message;
            var type;

            if (status === 'Completed' && outcome) {
                message = "Simulation '" + name + "' completed — " + outcome;
                type = outcome === 'Agreed' ? 'success' : 'warning';
            } else if (status === 'Failed') {
                message = "Simulation '" + name + "' failed";
                type = 'error';
            } else {
                message = "Simulation '" + name + "' completed";
                type = 'success';
            }

            message += ' — <a href="#Contact/view/' + contactId + '">' + this._escapeHtml(contactName) + '</a>';

            Espo.Ui.notify(message, type, 0);
        },

        // ─── Helpers ───────────────────────────────────────

        _escapeHtml: function (str) {
            if (!str) {
                return '';
            }

            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        },

        _escapeAttr: function (str) {
            return this._escapeHtml(str);
        },
    });
});
