<?php
/**
 * Proxy endpoint: POST /A2ASimulation/testConnection
 *
 * Tests the A2A API connection by calling the health endpoint.
 * Used by the Integration settings "Test Connection" button.
 *
 * Requires EspoCRM authentication (no noAuth).
 */

namespace Espo\Modules\A2ASimulation\Api;

use Espo\Core\Api\Action;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\Api\ResponseComposer;
use Espo\Entities\User;
use Espo\Modules\A2ASimulation\Services\A2AClient;
use Espo\ORM\EntityManager;

class PostTestConnection implements Action
{
    public function __construct(
        private A2AClient $a2aClient,
        private EntityManager $entityManager,
        private User $user,
    ) {}

    public function process(Request $request): Response
    {
        $result = $this->a2aClient->testConnection();

        return ResponseComposer::json([
            'success' => true,
            'data' => $result,
        ]);
    }
}
