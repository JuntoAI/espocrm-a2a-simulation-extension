<?php
/**
 * AfterInstall script for the A2A Simulation extension.
 *
 * Runs after extension installation to register the A2ASimulation entity
 * and rebuild metadata/database schema.
 */

namespace Espo\Modules\A2ASimulation\Scripts;

use Espo\Core\Container;

class AfterInstall
{
    public function run(Container $container): void
    {
        // Rebuild to register the new entity and metadata.
        $container->getByClass(\Espo\Core\DataManager::class)->rebuild();
    }
}
