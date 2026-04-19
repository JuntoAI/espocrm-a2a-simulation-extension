# Changelog

All notable changes to the A2A Simulation extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-07-15

### Added

- A2A Simulation panel on Contact detail view with simulation history and status badges
- Scenario Picker modal with pre-defined and custom simulation types
- Context auto-fill from Contact, Account, and Opportunity CRM data
- Live elapsed time counter and progress display for running simulations
- 10-second polling for real-time status updates with 10-minute timeout
- Completion notifications via Espo.Ui.notify() with outcome and Contact link
- Concurrent simulation prevention (one running simulation per Contact)
- PHP proxy endpoints for secure A2A API communication (API key never exposed to browser)
- Integration settings in Administration panel with Test Connection button
- A2ASimulation custom entity with session tracking and viewer URL
- AfterInstall script for automatic entity registration
- Property-based tests for context mapping, validation, polling, elapsed time, and concurrent prevention
- Full i18n support (en_US) for all entity fields, labels, and error messages
