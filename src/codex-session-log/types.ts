export type SessionKind = "direct" | "subagent";

export type TokenUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningOutputTokens: number;
  totalTokens: number;
  practicalBurn: number;
};

export type TokenPoint = {
  timestamp: Date;
  usage: TokenUsage;
  lastUsage: TokenUsage | null;
};

export type TokenDeltaPoint = {
  timestamp: Date;
  cumulativeUsage: TokenUsage;
  deltaUsage: TokenUsage;
};

export type TurnAttribution = {
  turnId: string;
  timestamp: Date;
  cwd: string;
  model: string | null;
  reasoningEffort: string | null;
};

export type AgentSpawnRequest = {
  timestamp: Date;
  agentType: string | null;
  model: string | null;
  reasoningEffort: string | null;
};

export type ParsedSession = {
  sessionId: string;
  sourceFilePath: string;
  cwd: string;
  kind: SessionKind;
  forkedFromSessionId: string | null;
  firstTimestamp: Date;
  lastTimestamp: Date;
  eventTimestamps: Date[];
  tokenPoints: TokenPoint[];
  finalTokenUsage: TokenUsage | null;
  userMessageTimestamps: Date[];
  turnAttributions: TurnAttribution[];
  agentSpawnRequests: AgentSpawnRequest[];
  primaryModel: string | null;
  primaryReasoningEffort: string | null;
};

export type SessionReadOptions = {
  sessionRootDirectory?: string;
  windowStart: Date;
  windowEnd: Date;
};
