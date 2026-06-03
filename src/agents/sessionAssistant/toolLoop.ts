import { actionNode, observationNode, thoughtNode } from "./nodes";
import type { AgentGraphState } from "./schema";

/** 会话 Assistant 本地工具链：Thought → Action → Observation */

export async function runToolLoop(
  userMessage: string,
  onPhase?: (phase: AgentGraphState["phase"], detail?: string) => void,
): Promise<AgentGraphState> {
  let state: AgentGraphState = {
    userMessage,
    thought: null,
    shouldAct: false,
    queryRequest: null,
    dbContext: null,
    errorMessage: null,
    phase: "idle",
    observation: null,
  };

  onPhase?.("thought");
  state = { ...state, ...(await thoughtNode(state)) };
  onPhase?.(state.phase, state.thought ?? undefined);

  if (!state.shouldAct) {
    return state;
  }

  onPhase?.("action");
  state = { ...state, ...(await actionNode(state)) };
  onPhase?.("action", state.dbContext?.description ?? undefined);

  onPhase?.("observation");
  state = { ...state, ...observationNode(state) };
  onPhase?.("done");

  return state;
}
