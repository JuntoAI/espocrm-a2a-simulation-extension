# Changelog

All notable changes to the A2A Simulation extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-04-19

### Changed
- **Breaking**: Authentication model switched from single `Authorization: Bearer` API key to dual-header auth per the Universal Architecture Guide:
  - `X-Integration-Token`: org-level token (replaces `apiKey` in admin config)
  - `X-User-Email`: logged-in CRM user's email (sent automatically on every request)
- Integration settings field renamed from "API Key" to "Integration Token" (`a2a_live_...` format)
- A2AClient service now injects the `User` entity to resolve the logged-in user's email
- Users without an email address on their EspoCRM account are blocked from making A2A requests

### Added
- Granular 403 error handling: domain mismatch, org deactivated/revoked, generic access denied
- 401 error handling distinguishes invalid token from invalid email
- 404 error handling for missing resources on the A2A API
- Frontend `_parse403Message` helper for user-friendly 403 error display in the scenario picker modal

### Fixed
- A2A Simulations panel not appearing on Contact detail view — added missing `relationships.json` layout file with `__APPEND__` directive
- Cross-platform build script — always uses Python zipfile to guarantee forward-slash paths

## [1.0.2] - 2026-04-19

### Fixed
- A2A Simulations panel not appearing on Contact detail view — added missing `relationships.json` layout file with `__APPEND__` directive so the panel is registered in the Contact bottom panels

## [1.0.1] - 2026-04-19

### Fixed
- Integration settings page 404 error — added missing `view` property to integration metadata so EspoCRM loads the built-in edit view instead of resolving to `null.js`

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
