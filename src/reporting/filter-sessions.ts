import type { ParsedSession } from "../codex-session-log/types.ts";
import type { SessionFilters, SessionGroupValue, SummaryGroupBy } from "./types.ts";

export function filterSessions(
  sessions: ParsedSession[],
  filters: SessionFilters,
): ParsedSession[] {
  return sessions.filter((session) => {
    if (
      filters.workspaceOnlyPrefix &&
      !session.cwd.startsWith(filters.workspaceOnlyPrefix)
    ) {
      return false;
    }

    if (filters.sessionKind && session.kind !== filters.sessionKind) {
      return false;
    }

    if (filters.model && session.primaryModel !== filters.model) {
      return false;
    }

    if (
      filters.reasoningEffort &&
      session.primaryReasoningEffort !== filters.reasoningEffort
    ) {
      return false;
    }

    return true;
  });
}

export function groupSessions(
  sessions: ParsedSession[],
  dimension: SummaryGroupBy,
): SessionGroupValue[] {
  const groupedSessions = new Map<string, ParsedSession[]>();

  for (const session of sessions) {
    const key =
      dimension === "model"
        ? session.primaryModel ?? "unknown"
        : session.primaryReasoningEffort ?? "unknown";
    const existingGroup = groupedSessions.get(key) ?? [];
    existingGroup.push(session);
    groupedSessions.set(key, existingGroup);
  }

  return [...groupedSessions.entries()]
    .map(([key, groupedValues]) => ({ key, sessions: groupedValues }))
    .sort((leftGroup, rightGroup) => rightGroup.sessions.length - leftGroup.sessions.length);
}
