<?php
/**
 * Proxy endpoint: GET /A2ASimulation/sessions/:id
 *
 * Polls the status of a running simulation session from the A2A API.
 * On completed/failed: updates the A2ASimulation record with outcome data.
 *
 * Requires EspoCRM authentication (no noAuth).
 */

namespace Espo\Modules\A2ASimulation\Api;

use Espo\Core\Api\Action;
use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\Api\ResponseComposer;
use Espo\Core\Exceptions\BadRequest;
use Espo\Entities\User;
use Espo\Modules\A2ASimulation\Services\A2AClient;
use Espo\ORM\EntityManager;

class GetSessionStatus implements Action
{
    public function __construct(
        private A2AClient $a2aClient,
        private EntityManager $entityManager,
        private User $user,
    ) {}

    public function process(Request $request): Response
    {
        $sessionId = $request->getRouteParam('id');

        if (!is_string($sessionId) || trim($sessionId) === '') {
            throw new BadRequest('Session ID is required.');
        }

        // Poll A2A API for session status.
        $result = $this->a2aClient->getSessionStatus($sessionId);

        // If completed or failed, update the A2ASimulation record.
        $status = $result['status'] ?? null;

        if ($status === 'completed' || $status === 'failed') {
            $simulation = $this->entityManager
                ->getRDBRepository('A2ASimulation')
                ->where(['sessionId' => $sessionId])
                ->findOne();

            if ($simulation) {
                $simulation->set('status', $status === 'completed' ? 'Completed' : 'Failed');
                $simulation->set('outcome', $result['outcome'] ?? null);
                $simulation->set('outcomeSummary', $result['outcome_summary'] ?? null);
                $simulation->set('viewerUrl', $result['viewer_url'] ?? null);
                $simulation->set('turnsCompleted', $result['turns_completed'] ?? null);
                $this->entityManager->saveEntity($simulation);
            }
        }

        return ResponseComposer::json($result);
    }
}
