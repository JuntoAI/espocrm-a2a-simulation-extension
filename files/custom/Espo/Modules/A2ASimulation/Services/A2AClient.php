<?php
/**
 * A2A Integration API client service.
 *
 * Central service for all communication with the JuntoAI A2A Simulation Engine.
 * Reads API credentials from the EspoCRM Integration entity and proxies
 * all requests through cURL with Bearer token authentication.
 *
 * API key never leaves server-side PHP — frontend calls EspoCRM endpoints,
 * which delegate to this service.
 */

namespace Espo\Modules\A2ASimulation\Services;

use Espo\Core\Exceptions\Error;
use Espo\Core\Exceptions\Forbidden;
use Espo\Core\Utils\Config;
use Espo\ORM\EntityManager;

class A2AClient
{
    /** Default A2A API base URL. */
    private const DEFAULT_BASE_URL = 'https://api.juntoai.org/api/v1/integrations';

    /** cURL timeout for A2A API requests in seconds. */
    private const REQUEST_TIMEOUT = 30;

    /** cURL connection timeout in seconds. */
    private const CONNECT_TIMEOUT = 10;

    public function __construct(
        private EntityManager $entityManager,
        private Config $config,
    ) {}

    /**
     * Fetch available simulation scenarios from the A2A API.
     *
     * @return array List of scenario objects.
     * @throws Error|Forbidden On API or configuration errors.
     */
    public function getScenarios(): array
    {
        return $this->request('GET', '/scenarios');
    }

    /**
     * Trigger a new simulation run.
     *
     * @param array  $context    Context data mapped from CRM entities.
     * @param string $scenarioId The scenario identifier to run.
     * @return array Response containing session_id and initial status.
     * @throws Error|Forbidden On API or configuration errors.
     */
    public function triggerSimulation(array $context, string $scenarioId): array
    {
        return $this->request('POST', '/simulate', [
            'scenario_id' => $scenarioId,
            'context' => $context,
        ]);
    }

    /**
     * Poll the status of a running simulation session.
     *
     * @param string $sessionId The A2A session identifier.
     * @return array Session status, outcome, and viewer URL (when complete).
     * @throws Error|Forbidden On API or configuration errors.
     */
    public function getSessionStatus(string $sessionId): array
    {
        return $this->request('GET', "/sessions/{$sessionId}");
    }

    /**
     * Test the API connection using the health endpoint.
     *
     * @return array Health check response.
     * @throws Error|Forbidden On API or configuration errors.
     */
    public function testConnection(): array
    {
        return $this->request('GET', '/health');
    }

    /**
     * Execute an HTTP request to the A2A API.
     *
     * Reads credentials from the Integration entity, builds a cURL request
     * with Bearer token auth, and handles error responses with user-friendly
     * exception messages.
     *
     * @param string     $method HTTP method (GET or POST).
     * @param string     $path   API path (e.g., "/scenarios").
     * @param array|null $body   Request body for POST requests.
     * @return array Decoded JSON response.
     * @throws Error     On connection failure, rate limit, or server errors.
     * @throws Forbidden On authentication failure (invalid API key).
     */
    private function request(string $method, string $path, ?array $body = null): array
    {
        $integration = $this->entityManager
            ->getRDBRepository('Integration')
            ->where(['id' => 'A2ASimulation'])
            ->findOne();

        if (!$integration) {
            throw new Error(
                'A2A Simulation integration not configured. '
                . 'Go to Administration > Integrations to set it up.'
            );
        }

        $data = $integration->get('data') ?? (object)[];
        $apiKey = $data->apiKey ?? null;
        $baseUrl = $data->baseUrl ?? self::DEFAULT_BASE_URL;

        if (!is_string($apiKey) || $apiKey === '') {
            throw new Error(
                'A2A API key not configured. '
                . 'Go to Administration > Integrations > A2A Simulation.'
            );
        }

        $url = rtrim($baseUrl, '/') . $path;

        $ch = curl_init($url);

        $headers = [
            'Authorization: Bearer ' . $apiKey,
            'Accept: application/json',
        ];

        $options = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => self::REQUEST_TIMEOUT,
            CURLOPT_CONNECTTIMEOUT => self::CONNECT_TIMEOUT,
            CURLOPT_HTTPHEADER     => $headers,
        ];

        if ($method === 'POST') {
            $options[CURLOPT_POST] = true;
            $options[CURLOPT_POSTFIELDS] = json_encode($body, JSON_UNESCAPED_UNICODE);
            $headers[] = 'Content-Type: application/json';
            $options[CURLOPT_HTTPHEADER] = $headers;
        }

        curl_setopt_array($ch, $options);

        $responseBody = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErrno = curl_errno($ch);

        curl_close($ch);

        // Connection failure — DNS, refused, timeout.
        if ($curlErrno !== 0) {
            throw new Error(
                'Simulation service temporarily unavailable. Try again later.'
            );
        }

        // Decode response.
        $decoded = json_decode($responseBody, true);

        if (!is_array($decoded)) {
            $decoded = [];
        }

        // Handle HTTP error statuses.
        if ($httpCode === 401) {
            throw new Forbidden(
                'Invalid A2A API key. Check Administration > Integrations.'
            );
        }

        if ($httpCode === 429) {
            throw new Error(
                'Daily simulation limit reached. Resets at midnight UTC.'
            );
        }

        if ($httpCode >= 500) {
            throw new Error(
                'Simulation service temporarily unavailable. Try again later.'
            );
        }

        return $decoded;
    }
}
