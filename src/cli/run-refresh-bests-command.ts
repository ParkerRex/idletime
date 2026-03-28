import { notifyNearBestMetrics } from "../best-metrics/near-best-notifications.ts";
import { notifyBestEvents } from "../best-metrics/notify-best-events.ts";
import { refreshBestMetrics } from "../best-metrics/refresh-best-metrics.ts";

export async function runRefreshBestsCommand(
  options: {
    now?: Date;
    platform?: NodeJS.Platform;
    sessionRootDirectory?: string;
    stateDirectory?: string;
  } = {},
): Promise<string> {
  const refreshedBestMetrics = await refreshBestMetrics(options);
  await notifyBestEvents(refreshedBestMetrics.newBestEvents, options);
  await notifyNearBestMetrics(
    refreshedBestMetrics.currentMetrics,
    refreshedBestMetrics.ledger,
    options,
  );

  return [
    "BEST metrics refreshed",
    `mode: ${refreshedBestMetrics.refreshMode}`,
    `new bests: ${refreshedBestMetrics.newBestEvents.length}`,
    `last scanned: ${refreshedBestMetrics.ledger.lastScannedAt.toISOString()}`,
  ].join("\n");
}
