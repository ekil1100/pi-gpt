import { join } from "node:path";
import {
  getAgentDir,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Effect, Either } from "effect";
import { describeState, isActive, transformRequest, type FastModeState } from "./state.ts";
import { loadState, saveState } from "./storage.ts";

const updateStatus = (ctx: ExtensionContext, state: FastModeState): void => {
  ctx.ui.setStatus(
    "gpt-fast-mode",
    isActive(state, ctx.model) ? ctx.ui.theme.fg("accent", "fast") : undefined,
  );
};

export default function piGpt(pi: ExtensionAPI): void {
  const path = join(getAgentDir(), "extensions", "pi-gpt.json");
  let state = Effect.runSync(loadState(path));

  pi.registerCommand("fast", {
    description: "Toggle GPT Fast mode for configured models",
    handler: async (args, ctx) => {
      if (args.trim()) {
        ctx.ui.notify("Usage: /fast", "error");
        return;
      }
      const next = { ...state, enabled: !state.enabled };
      const saved = Effect.runSync(Effect.either(saveState(path, next)));
      if (Either.isLeft(saved)) {
        ctx.ui.notify(`Failed to save Fast mode: ${String(saved.left)}`, "error");
        return;
      }
      state = next;
      updateStatus(ctx, state);
      ctx.ui.notify(describeState(state, ctx.model), "info");
    },
  });

  pi.on("session_start", (_event, ctx) => {
    state = Effect.runSync(loadState(path));
    updateStatus(ctx, state);
  });
  pi.on("model_select", (_event, ctx) => updateStatus(ctx, state));
  pi.on("before_provider_request", (event, ctx) =>
    transformRequest(state, ctx.model, event.payload),
  );
}
