import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { Effect } from "effect";
import { decodeState, emptyState, type FastModeState } from "./state.ts";

const isMissing = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";

export const loadState = (path: string) =>
  Effect.try({
    try: () => readFileSync(path, "utf8"),
    catch: (error) => error,
  }).pipe(
    Effect.flatMap((text) => Effect.try(() => decodeState(text))),
    Effect.catchAll((error) =>
      Effect.sync(() => {
        if (!isMissing(error)) console.warn(`[pi-gpt] Failed to read ${path}: ${String(error)}`);
        return emptyState();
      }),
    ),
  );

export const saveState = (path: string, state: FastModeState) =>
  Effect.try(() => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  });
