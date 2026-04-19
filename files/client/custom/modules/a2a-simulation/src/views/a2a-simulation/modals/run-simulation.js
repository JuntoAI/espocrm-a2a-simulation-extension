/**
 * Run Simulation Modal — Scenario Picker
 *
 * Two-phase modal:
 * 1. Scenario selection: fetch and display scenario cards + "Build Custom" option
 * 2. Context review: auto-fill CRM data into context fields, allow edits, validate, start
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */
define('a2a-simulation:views/a2a-simulation/modals/run-simulation', ['views/modal'], function (Dep) {

    var SIMULATION_TYPES = [
        {value: 'sales_call', label: 'Sales Call'},
        {value: 'investor_pitch', label: 'Investor Pitch'},
        {value: 'enterprise_b2b', label: 'Enterprise B2B Sales'},
        {value: 'partnership', label: 'Partnership Negotiation'},
        {value: 'renewal', label: 'Contract Renewal'},
    ];

    var REQUIRED_CONTEXT_FIELDS = ['contact_name', 'company', 'role'];

    return Dep.extend({

        className: 'dialog dialog-record',

        header: 'Run A2A Simulation',

        buttonList: [
            {
                name: 'startSimulation',
                label: 'Start Simulation',
                style: 'primary',
                disabled: true,
            },
            {
                name: 'cancel',
                label: 'Cancel',
            },
        ],

        /**
         * Modal state.
         */
        phase: 'selection', // 'selection' | 'context'
        scenarios: null,
        selectedScenario: null,
        isCustom: false,
        customType: null,
        context: null,
        isLoadingScenarios: true,

        setup: function () {
            Dep.prototype.setup.call(this);

            this.scenarios = [];
            this.context = {};

            this._fetchScenarios();
        },

        afterRender: function () {
            if (this.phase === 'selection') {
                this._renderSelectionPhase();
            } else {
                this._renderContextPhase();
            }
        },

        // ─── Scenario Fetching ─────────────────────────────

        _fetchScenarios: function () {
            var self = this;

            this.isLoadingScenarios = true;

            Espo.Ajax.getRequest('A2ASimulation/scenarios')
                .then(function (response) {
                    self.isLoadingScenarios = false;
                    self.scenarios = response.list || response || [];

                    if (self.isRendered()) {
                        self._renderSelectionPhase();
                    }
                })
                .catch(function (xhr) {
                    self.isLoadingScenarios = false;
                    self.scenarios = [];

                    var msg = 'Failed to load scenarios.';

                    if (xhr && xhr.status === 502) {
                        msg = 'Simulation service temporarily unavailable. Try again later.';
                    } else if (xhr && xhr.status === 403) {
                        msg = "You don't have permission to run simulations.";
                    }

                    if (self.isRendered()) {
                        self._renderError(msg);
                    } else {
                        Espo.Ui.notify(msg, 'error', 5000);
                    }
                });
        },

        // ─── Phase 1: Scenario Selection ───────────────────

        _renderSelectionPhase: function () {
            var $body = this.$el.find('.modal-body');

            if (!$body.length) {
                return;
            }

            if (this.isLoadingScenarios) {
                $body.html(
                    '<div class="text-center" style="padding: 40px 0;">' +
                        '<span class="fas fa-spinner fa-spin"></span> Loading scenarios...' +
                    '</div>'
                );
                return;
            }

            var html = '<div class="scenario-picker">';

            // Scenario cards
            if (this.scenarios.length) {
                html += '<div class="scenario-cards">';

                for (var i = 0; i < this.scenarios.length; i++) {
                    var s = this.scenarios[i];
                    html += this._buildScenarioCard(s);
                }

                html += '</div>';
            }

            // Build Custom option
            html += '<div class="scenario-custom-section" style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd;">';
            html += '<h5 style="margin-bottom: 10px;">Build Custom Simulation</h5>';
            html += '<div class="form-group">';
            html += '<label>Simulation Type</label>';
            html += '<select class="form-control" data-action="selectCustomType">';
            html += '<option value="">-- Select Type --</option>';

            for (var j = 0; j < SIMULATION_TYPES.length; j++) {
                var t = SIMULATION_TYPES[j];
                html += '<option value="' + t.value + '">' + t.label + '</option>';
            }

            html += '</select>';
            html += '</div>';
            html += '<button class="btn btn-default" data-action="selectCustom" disabled>Use Custom Scenario</button>';
            html += '</div>';

            html += '</div>';

            $body.html(html);
            this._bindSelectionEvents();
        },

        _buildScenarioCard: function (scenario) {
            var name = this._escapeHtml(scenario.name || 'Unnamed');
            var description = this._escapeHtml(scenario.description || '');
            var category = this._escapeHtml(scenario.category || '');
            var difficulty = this._escapeHtml(scenario.difficulty || scenario.difficulty_level || '');

            var html = '<div class="scenario-card" data-scenario-id="' + this._escapeAttr(scenario.id || '') + '" ' +
                'style="border: 1px solid #ddd; border-radius: 4px; padding: 12px; margin-bottom: 10px; cursor: pointer; transition: border-color 0.2s;">';

            html += '<div style="display: flex; justify-content: space-between; align-items: flex-start;">';
            html += '<strong style="font-size: 14px;">' + name + '</strong>';

            if (difficulty) {
                var badgeColor = difficulty === 'Hard' ? '#d9534f' : (difficulty === 'Medium' ? '#f0ad4e' : '#5cb85c');
                html += '<span style="font-size: 11px; padding: 2px 6px; border-radius: 3px; background: ' + badgeColor + '; color: #fff;">' + difficulty + '</span>';
            }

            html += '</div>';

            if (description) {
                html += '<p style="margin: 6px 0 4px; font-size: 13px; color: #666;">' + description + '</p>';
            }

            if (category) {
                html += '<span style="font-size: 11px; color: #999;">' + category + '</span>';
            }

            html += '</div>';

            return html;
        },

        _bindSelectionEvents: function () {
            var self = this;

            this.$el.find('.scenario-card').on('click', function () {
                var scenarioId = $(this).data('scenario-id');
                self._selectScenario(scenarioId);
            });

            this.$el.find('[data-action="selectCustomType"]').on('change', function () {
                self.customType = $(this).val();
                self.$el.find('[data-action="selectCustom"]').prop('disabled', !self.customType);
            });

            this.$el.find('[data-action="selectCustom"]').on('click', function () {
                if (self.customType) {
                    self._selectCustomScenario();
                }
            });
        },

        _selectScenario: function (scenarioId) {
            for (var i = 0; i < this.scenarios.length; i++) {
                if (this.scenarios[i].id === scenarioId) {
                    this.selectedScenario = this.scenarios[i];
                    break;
                }
            }

            this.isCustom = false;
            this._transitionToContext();
        },

        _selectCustomScenario: function () {
            var typeLabel = '';

            for (var i = 0; i < SIMULATION_TYPES.length; i++) {
                if (SIMULATION_TYPES[i].value === this.customType) {
                    typeLabel = SIMULATION_TYPES[i].label;
                    break;
                }
            }

            this.selectedScenario = {
                id: 'custom_' + this.customType,
                name: typeLabel || 'Custom Simulation',
                category: 'Custom',
            };

            this.isCustom = true;
            this._transitionToContext();
        },

        // ─── Phase 2: Context Review ───────────────────────

        _transitionToContext: function () {
            this.phase = 'context';
            this._buildContext();
            this._renderContextPhase();
        },

        _buildContext: function () {
            var contact = this.model;

            this.context = {
                contact_name: contact.get('name') || '',
                company: contact.get('accountName') || '',
                role: contact.get('title') || '',
                industry: '',
                deal_value: null,
                deal_stage: null,
            };

            // Fetch Account details for industry
            var accountId = contact.get('accountId');

            if (accountId) {
                this._fetchAccountData(accountId);
            }

            // Fetch related Opportunity
            this._fetchOpportunityData();
        },

        _fetchAccountData: function (accountId) {
            var self = this;

            Espo.Ajax.getRequest('Account/' + accountId)
                .then(function (account) {
                    if (account && account.industry) {
                        self.context.industry = account.industry;
                        self._updateFieldDisplay('industry', account.industry);
                    }

                    if (account && account.name && !self.context.company) {
                        self.context.company = account.name;
                        self._updateFieldDisplay('company', account.name);
                    }

                    self._validateFields();
                })
                .catch(function () {
                    // Silently fail — industry just stays empty
                });
        },

        _fetchOpportunityData: function () {
            var self = this;
            var contactId = this.model.id;

            Espo.Ajax.getRequest('Contact/' + contactId + '/opportunities', {
                maxSize: 1,
                orderBy: 'createdAt',
                order: 'desc',
            })
                .then(function (response) {
                    if (response.list && response.list.length) {
                        var opp = response.list[0];

                        if (opp.amount) {
                            self.context.deal_value = opp.amount;
                            self._updateFieldDisplay('deal_value', opp.amount);
                        }

                        if (opp.stage) {
                            self.context.deal_stage = opp.stage;
                            self._updateFieldDisplay('deal_stage', opp.stage);
                        }
                    }

                    self._validateFields();
                })
                .catch(function () {
                    // Silently fail — deal fields stay null
                });
        },

        _renderContextPhase: function () {
            var $body = this.$el.find('.modal-body');

            if (!$body.length) {
                return;
            }

            var scenarioName = this._escapeHtml(this.selectedScenario.name || 'Simulation');

            var html = '<div class="context-review">';
            html += '<p style="margin-bottom: 15px;">Scenario: <strong>' + scenarioName + '</strong></p>';
            html += '<p style="margin-bottom: 15px; color: #666; font-size: 13px;">Review and edit the context fields below. Required fields are marked with *.</p>';

            html += '<div class="context-fields">';
            html += this._buildFieldRow('contact_name', 'Contact Name *', this.context.contact_name, true);
            html += this._buildFieldRow('company', 'Company *', this.context.company, true);
            html += this._buildFieldRow('role', 'Role / Title *', this.context.role, true);
            html += this._buildFieldRow('industry', 'Industry', this.context.industry, false);
            html += this._buildFieldRow('deal_value', 'Deal Value', this.context.deal_value || '', false, 'number');
            html += this._buildFieldRow('deal_stage', 'Deal Stage', this.context.deal_stage || '', false);
            html += '</div>';

            html += '</div>';

            $body.html(html);
            this._bindContextEvents();
            this._validateFields();
        },

        _buildFieldRow: function (fieldName, label, value, required, type) {
            var inputType = type || 'text';
            var val = (value !== null && value !== undefined) ? value : '';

            var html = '<div class="form-group" data-field="' + fieldName + '">';
            html += '<label>' + this._escapeHtml(label) + '</label>';
            html += '<input type="' + inputType + '" class="form-control context-field" ' +
                'data-context-field="' + fieldName + '" ' +
                'value="' + this._escapeAttr(String(val)) + '"';

            if (required) {
                html += ' required';
            }

            html += '>';
            html += '</div>';

            return html;
        },

        _bindContextEvents: function () {
            var self = this;

            this.$el.find('.context-field').on('input', function () {
                var field = $(this).data('context-field');
                var val = $(this).val();

                if (field === 'deal_value') {
                    self.context[field] = val ? parseFloat(val) : null;
                } else {
                    self.context[field] = val;
                }

                self._validateFields();
            });
        },

        _updateFieldDisplay: function (fieldName, value) {
            var $input = this.$el.find('[data-context-field="' + fieldName + '"]');

            if ($input.length && !$input.val()) {
                $input.val(value !== null && value !== undefined ? value : '');
            }
        },

        // ─── Validation ────────────────────────────────────

        _validateFields: function () {
            var valid = true;

            for (var i = 0; i < REQUIRED_CONTEXT_FIELDS.length; i++) {
                var field = REQUIRED_CONTEXT_FIELDS[i];
                var val = this.context[field];

                if (!val || !String(val).trim()) {
                    valid = false;
                    break;
                }
            }

            this._toggleStartButton(valid);
        },

        _toggleStartButton: function (enabled) {
            var $btn = this.$el.find('[data-name="startSimulation"]');

            if (!$btn.length) {
                return;
            }

            if (enabled) {
                $btn.prop('disabled', false).removeClass('disabled');
            } else {
                $btn.prop('disabled', true).addClass('disabled');
            }
        },

        // ─── Start Simulation ──────────────────────────────

        actionStartSimulation: function () {
            if (!this.selectedScenario) {
                return;
            }

            // Final validation
            for (var i = 0; i < REQUIRED_CONTEXT_FIELDS.length; i++) {
                var field = REQUIRED_CONTEXT_FIELDS[i];

                if (!this.context[field] || !String(this.context[field]).trim()) {
                    Espo.Ui.notify('Please fill all required fields.', 'error', 3000);
                    return;
                }
            }

            var self = this;
            var payload = {
                scenarioId: this.selectedScenario.id,
                scenarioName: this.selectedScenario.name || 'Simulation',
                contactId: this.model.id,
                context: this.context,
            };

            this._toggleStartButton(false);

            Espo.Ajax.postRequest('A2ASimulation/simulate', payload)
                .then(function () {
                    self.trigger('simulation-started');
                    self.close();
                })
                .catch(function (xhr) {
                    self._toggleStartButton(true);

                    var msg = 'Could not start simulation. Try again.';

                    if (xhr && xhr.status === 429) {
                        msg = 'Daily simulation limit reached. Resets at midnight UTC.';
                    } else if (xhr && xhr.status === 502) {
                        msg = 'Simulation service temporarily unavailable. Try again later.';
                    } else if (xhr && xhr.status === 403) {
                        msg = "You don't have permission to run simulations.";
                    }

                    Espo.Ui.notify(msg, 'error', 5000);
                });
        },

        // ─── Error Display ─────────────────────────────────

        _renderError: function (message) {
            var $body = this.$el.find('.modal-body');

            if (!$body.length) {
                return;
            }

            $body.html(
                '<div class="text-center" style="padding: 40px 0; color: #a94442;">' +
                    '<span class="fas fa-exclamation-triangle"></span> ' +
                    this._escapeHtml(message) +
                '</div>'
            );
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
