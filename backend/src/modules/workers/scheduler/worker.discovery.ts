import { WorkerRepository } from '../worker.repository.js';
import { WorkerRegistry } from './worker.registry.js';
import {
  HEARTBEAT_OFFLINE_THRESHOLD_MS,
  DISCOVERY_SCAN_INTERVAL_MS,
} from '../worker.constants.js';
import { logger } from '../../../common/logger/logger.js';
import { eventBus } from '../../../events/event.bus.js';

/**
 * Worker Discovery Service
 *
 * Runs a periodic background scan to:
 * 1. Detect workers with stale heartbeats and mark them OFFLINE
 * 2. Trigger failover for crashed workers (requeue their jobs)
 * 3. Publish worker online/offline events
 */
export class WorkerDiscovery {
  private static scanInterval: ReturnType<typeof setInterval> | null = null;
  private static isRunning = false;

  /**
   * Start the discovery service with periodic heartbeat checks.
   */
  static start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    logger.info(
      `[WorkerDiscovery] Started. Scanning every ${DISCOVERY_SCAN_INTERVAL_MS / 1000}s, ` +
      `offline threshold: ${HEARTBEAT_OFFLINE_THRESHOLD_MS / 1000}s`
    );

    // Run initial scan
    this.scan().catch((err) => {
      logger.error(`[WorkerDiscovery] Initial scan failed: ${err.message}`);
    });

    // Periodic scan
    this.scanInterval = setInterval(() => {
      this.scan().catch((err) => {
        logger.error(`[WorkerDiscovery] Periodic scan failed: ${err.message}`);
      });
    }, DISCOVERY_SCAN_INTERVAL_MS);
  }

  /**
   * Perform a single discovery scan.
   */
  static async scan(): Promise<void> {
    try {
      // Mark stale workers as OFFLINE
      const offlineIds = await WorkerRepository.markStaleOffline(HEARTBEAT_OFFLINE_THRESHOLD_MS);

      if (offlineIds.length > 0) {
        logger.warn(`[WorkerDiscovery] ${offlineIds.length} worker(s) went OFFLINE due to missed heartbeats`);

        for (const workerId of offlineIds) {
          // Remove from in-memory registry or update status
          const worker = WorkerRegistry.get(workerId);
          if (worker) {
            WorkerRegistry.set({ ...worker, status: 'OFFLINE' as any });
          }

          // Publish offline event
          eventBus.publish('worker.offline', {
            workerId,
            reason: 'Heartbeat timeout',
          });
        }
      }

      // Sync the registry cache
      await WorkerRegistry.sync();
    } catch (err) {
      logger.error(`[WorkerDiscovery] Scan error: ${(err as Error).message}`);
    }
  }

  /**
   * Stop the discovery service.
   */
  static stop(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    this.isRunning = false;
    logger.info('[WorkerDiscovery] Stopped');
  }
}
