<?php
/**
 * Proxy endpoint: GET /A2ASimulation/scenarios
 *
 * Fetches available simulation scenarios from the A2A API.
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

class GetScenarios implements Action
{
    public function __construct(
        private A2AClient $a2aClient,
        private EntityManager $entityManager,
        private User $user,
    ) {}

    public function process(Request $request): Response
    {
        $result = $this->a2aClient->getScenarios();

        return ResponseComposer::json($result);
    }
}
