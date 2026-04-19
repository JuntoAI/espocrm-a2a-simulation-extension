<?php
/**
 * Proxy endpoint: POST /A2ASimulation/simulate
 *
 * Triggers a new simulation run via the A2A API.
 * Validates request body, proxies to A2A, and creates an A2ASimulation
 * entity record on success.
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

class PostSimulate implements Action
{
    public function __construct(
        private A2AClient $a2aClient,
        private EntityManager $entityManager,
        private User $user,
    ) {}

    public function process(Request $request): Response
    {
        $body = $request->getParsedBody();

        $scenarioId = $body->scenarioId ?? null;
        $context = $body->context ?? null;
        $contactId = $body->contactId ?? null;
        $scenarioName = $body->scenarioName ?? null;

        // Validate required fields.
        if (!is_string($scenarioId) || trim($scenarioId) === '') {
            throw new BadRequest('scenarioId is required and must be a non-empty string.');
        }

        if ($context === null || (!is_array($context) && !is_object($context))) {
            throw new BadRequest('context is required and must be an object or array.');
        }

        // Normalize context to array for the A2A client.
        $contextArray = is_object($context) ? (array) $context : $context;

        // Trigger simulation via A2A API.
        $result = $this->a2aClient->triggerSimulation($contextArray, $scenarioId);

        // Create A2ASimulation entity record.
        $entity = $this->entityManager->getNewEntity('A2ASimulation');
        $entity->set('name', $scenarioName ?? $scenarioId);
        $entity->set('sessionId', $result['session_id'] ?? null);
        $entity->set('contactId', $contactId);
        $entity->set('scenarioId', $scenarioId);
        $entity->set('status', 'Running');
        $this->entityManager->saveEntity($entity);

        return ResponseComposer::json([
            'id' => $entity->getId(),
            'sessionId' => $result['session_id'] ?? null,
            'status' => 'Running',
            'scenarioId' => $scenarioId,
            'name' => $entity->get('name'),
        ]);
    }
}
