# A2A Simulation — EspoCRM Extension

EspoCRM extension that connects to the JuntoAI A2A (Agent-to-Agent) Simulation Engine. Run AI-powered negotiation simulations directly from Contact detail views.

## Features

- **Simulation Panel** on Contact detail views — see history, trigger new simulations
- **Scenario Picker** modal with CRM context auto-fill from Contact/Account/Opportunity
- **Live Status Tracking** — polling with elapsed time counter and turn progress
- **Glass Box Viewer** link — open full simulation transcript and evaluation in A2A
- **Secure API Proxy** — API key never reaches the browser; all calls proxied through PHP

## Requirements

- EspoCRM >= 9.0.0
- PHP >= 8.1
- A2A Integration API access (API key from JuntoAI)

## Installation

1. Download or build `a2a-simulation-extension.zip`
2. In EspoCRM: Administration > Extensions > Upload & Install
3. Go to Administration > Integrations > A2A Simulation
4. Enter your API key and base URL
5. Click "Test Connection" to verify

## Development

```bash
npm install
npm test
npm run build
```

## Architecture

The extension is a **thin CRM client**. All simulation logic lives in A2A. The CRM handles:
- Configuration (API key, base URL)
- Trigger (scenario selection + context mapping)
- Poll (status updates every 10s)
- Display pointer (viewer URL to Glass Box)

No simulation data (transcripts, reasoning, scores) is stored in EspoCRM.

## License

MIT
