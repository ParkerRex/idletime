import { deliverLocalNotifications } from "./notification-delivery.ts";
import type {
  BestEvent,
} from "./types.ts";
import type { NotificationDeliveryOptions, NotificationPayload } from "./notification-delivery.ts";

export async function notifyBestEvents(
  bestEvents: BestEvent[],
  options: NotificationDeliveryOptions = {},
): Promise<void> {
  await deliverLocalNotifications(
    bestEvents.map((bestEvent) => buildBestEventNotification(bestEvent)),
    options,
  );
}

export function buildBestEventNotification(
  bestEvent: BestEvent,
): NotificationPayload {
  return {
    title: resolveNotificationTitle(bestEvent.metric),
    body: resolveNotificationBody(bestEvent),
  };
}

function resolveNotificationTitle(bestMetricKey: BestEvent["metric"]): string {
  return bestMetricKey === "bestConcurrentAgents"
    ? "New best concurrent agents"
    : bestMetricKey === "best24hRawBurn"
      ? "New best 24hr raw burn"
      : "New best agent sum";
}

function resolveNotificationBody(bestEvent: BestEvent): string {
  return bestEvent.metric === "bestConcurrentAgents"
    ? `${formatInteger(bestEvent.value)} concurrent agents`
    : bestEvent.metric === "best24hRawBurn"
      ? `${formatCompactInteger(bestEvent.value)} 24hr raw burn`
      : `${formatAgentSumHours(bestEvent.value)} agent sum`;
}

function formatAgentSumHours(durationMs: number): string {
  const hours = durationMs / 3_600_000;
  return hours >= 10
    ? Math.round(hours).toString()
    : (Math.round(hours * 10) / 10).toString();
}

function formatCompactInteger(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Math.round(value)).toUpperCase();
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}
