import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type NotificationPayload = {
  body: string;
  title: string;
};

export type NotificationDeliveryOptions = {
  notifier?: (notification: NotificationPayload) => Promise<void>;
  platform?: NodeJS.Platform;
};

export async function deliverLocalNotifications(
  notifications: NotificationPayload[],
  options: NotificationDeliveryOptions = {},
): Promise<void> {
  const platform = options.platform ?? process.platform;
  if (platform !== "darwin" || notifications.length === 0) {
    return;
  }

  const notifier = options.notifier ?? sendMacOsNotification;
  for (const notification of notifications) {
    try {
      await notifier(notification);
    } catch {
      return;
    }
  }
}

async function sendMacOsNotification(
  notification: NotificationPayload,
): Promise<void> {
  const notificationIconPath = resolveNotificationIconPath();

  try {
    await execFileAsync("terminal-notifier", [
      "-title",
      notification.title,
      "-message",
      notification.body,
      ...(notificationIconPath
        ? ["-appIcon", pathToFileURL(notificationIconPath).href]
        : []),
    ]);
    return;
  } catch (error) {
    if (!isCommandMissingError(error)) {
      throw error;
    }
  }

  await execFileAsync("osascript", [
    "-e",
    `display notification "${escapeAppleScriptText(notification.body)}" with title "${escapeAppleScriptText(notification.title)}"`,
  ]);
}

function escapeAppleScriptText(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function resolveNotificationIconPath(): string | null {
  const candidatePaths = [
    fileURLToPath(
      new URL("../../assets/idle-time-notification-icon.png", import.meta.url),
    ),
    fileURLToPath(
      new URL("../assets/idle-time-notification-icon.png", import.meta.url),
    ),
  ];

  return candidatePaths.find((candidatePath) => existsSync(candidatePath)) ?? null;
}

function isCommandMissingError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
