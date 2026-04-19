<?php
/**
 * A2A Integration API client service.
 *
 * Central service for all communication with the JuntoAI A2A Simulation Engine.
 * Reads the integration token from the EspoCRM Integration entity and proxies
 * all requests through cURL with dual-header authentication:
 *
 *   X-Integration-Token: org-level token (from admin config)
 *   X-User-Email: logged-in CRM user's email (per-request)
 *
 * The A2A API validates that the email domain matches the org's registered domain.
 * Integration token never leaves server-side PHP — frontend calls EspoCRM endpoints,
 * which delegate to this service.
 */

namespace Espo\Modules\A2ASimulation\Services;

use Espo\Core\Exceptions\Error;
use Espo\Core\Exceptions\Forbidden;
use Espo\Core\Utils\Config;
use Espo\Entities\User;
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
        private User $user,
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
     * Get the email address of the currently logged-in user.
     *
     * @return string User email or empty string if not available.
     */
    private function getUserEmail(): string
    {
        $emailAddress = $this->user->get('emailAddress');

        if (is_string($emailAddress) && $emailAddress !== '') {
            return $emailAddress;
        }

        return '';
    }

    /**
     * Execute an HTTP request to the A2A API.
     *
     * Reads credentials from the Integration entity, builds a cURL request
     * with X-Integration-Token and X-User-Email headers, and handles error
     * responses with user-friendly exception messages.
     *
     * @param string     $method HTTP method (GET or POST).
     * @param string     $path   API path (e.g., "/scenarios").
     * @param array|null $body   Request body for POST requests.
     * @return array Decoded JSON response.
     * @throws Error     On connection failure, rate limit, or server errors.
     * @throws Forbidden On authentication or authorization failure.
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
        $integrationToken = $data->integrationToken ?? null;
        $baseUrl = $data->baseUrl ?? self::DEFAULT_BASE_URL;

        if (!is_string($integrationToken) || $integrationToken === '') {
            throw new Error(
                'A2A Integration Token not configured. '
                . 'Go to Administration > Integrations > A2A Simulation.'
            );
        }

        $userEmail = $this->getUserEmail();

        if ($userEmail === '') {
            throw new Forbidden(
                'Your EspoCRM user account has no email address. '
                . 'An email is required to authenticate with the A2A API.'
            );
        }

        $url = rtrim($baseUrl, '/') . $path;

        $ch = curl_init($url);

        $headers = [
            'X-Integration-Token: ' . $integrationToken,
            'X-User-Email: ' . $userEmail,
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

        // Handle HTTP error statuses per architecture guide §7.
        if ($httpCode === 401) {
            $detail = $decoded['detail'] ?? '';

            if (stripos($detail, 'email') !== false) {
                throw new Forbidden(
                    'User email is not valid. Contact your admin.'
                );
            }

            throw new Forbidden(
                'Invalid integration token. Check Administration > Integrations.'
            );
        }

        if ($httpCode === 403) {
            $detail = $decoded['detail'] ?? '';

            if (stripos($detail, 'domain') !== false) {
                throw new Forbidden(
                    'Your email domain is not authorized for this integration.'
                );
            }

            if (stripos($detail, 'deactivated') !== false || stripos($detail, 'revoked') !== false) {
                throw new Forbidden(
                    'Integration access has been revoked. Contact JuntoAI support.'
                );
            }

            throw new Forbidden(
                'Access denied. Contact your admin or JuntoAI support.'
            );
        }

        if ($httpCode === 404) {
            throw new Error(
                $decoded['detail'] ?? 'Resource not found on the A2A API.'
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
