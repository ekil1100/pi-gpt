import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { decodeState, emptyState, transformRequest } from "../src/state.ts";
import { loadState, saveState } from "../src/storage.ts";

const model = { provider: "openai", id: "gpt-6-astra" };
const active = { enabled: true, models: ["openai/gpt-6-astra"] };
const directories: string[] = [];
const temp = () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-gpt-"));
  directories.push(dir);
  return dir;
};
afterEach(() => {
  directories.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
  vi.restoreAllMocks();
});

describe("request policy", () => {
  it("adds priority without mutating the original request", () => {
    const payload = Object.freeze({ model: model.id, service_tier: "auto", input: "Hello" });
    expect(transformRequest(active, model, payload)).toEqual({
      ...payload,
      service_tier: "priority",
    });
    expect(payload.service_tier).toBe("auto");
  });
  it("requires both enabled mode and an exact provider/model match", () => {
    expect(transformRequest({ ...active, enabled: false }, model, {})).toBeUndefined();
    expect(transformRequest(active, { ...model, provider: "proxy" }, {})).toBeUndefined();
    expect(transformRequest(active, undefined, {})).toBeUndefined();
    expect(transformRequest(emptyState(), model, {})).toBeUndefined();
  });
  it.each([
    ["/[/]gpt-6-astra$/", "openai", "gpt-6-astra", true],
    ["/[/]gpt-6-astra$/", "openai-codex", "gpt-6-astra", true],
    ["/[/]gpt-6-astra$/", "magpie", "codex/gpt-6-astra", true],
    ["/[/]gpt-6-astra$/", "openai", "gpt-6-astra-pro", false],
    ["/[/]gpt-6-astra$/", "openai", "other-gpt-6-astra", false],
    ["/[/]gpt-6-(astra|sol)$/", "magpie", "codex/gpt-6-sol", true],
    ["/^openai[/]gpt-/", "openai", "gpt-6-astra", true],
    ["/^openai[/]gpt-/", "magpie", "gpt-6-astra", false],
    ["/[/]gpt-5\\.4$/", "openai", "gpt-5.4", true],
    ["/[/]gpt-5\\.4$/", "openai", "gpt-5x4", false],
    ["openai/gpt-5.4", "openai", "gpt-5x4", false],
    ["openai/gpt-[6]+?", "openai", "gpt-[6]+?", true],
    ["*/gpt-6-astra", "openai", "gpt-6-astra", false],
    ["/.*/", "magpie", "codex/gpt-6-astra", true],
  ])("matches %s against %s/%s: %s", (pattern, provider, id, matches) => {
    const state = decodeState(JSON.stringify({ enabled: true, models: [pattern] }));
    expect(transformRequest(state, { provider, id }, {})).toEqual(
      matches ? { service_tier: "priority" } : undefined,
    );
    expect(transformRequest({ ...state, enabled: false }, { provider, id }, {})).toBeUndefined();
    expect(transformRequest(state, undefined, {})).toBeUndefined();
  });
  it.each([null, [], "text", 42, undefined])("ignores invalid payload %s", (payload) => {
    expect(transformRequest(active, model, payload)).toBeUndefined();
  });
});

describe("state persistence", () => {
  it("reads the existing extension format, including model ids with slashes", () => {
    expect(decodeState(JSON.stringify(active))).toEqual(active);
    expect(decodeState('{"enabled":true,"models":["magpie/codex/gpt-6-astra"]}').models).toEqual([
      "magpie/codex/gpt-6-astra",
    ]);
  });
  it.each(["{}", '{"enabled":"true","models":[]}', '{"enabled":true,"models":["bad"]}'])(
    "rejects malformed state %s",
    (text) => expect(() => decodeState(text)).toThrow(),
  );
  it.each(["/[invalid/", "/unfinished", "//", "/gpt/i"])(
    "rejects invalid regex rule %s",
    (rule) => {
      expect(() => decodeState(JSON.stringify({ enabled: true, models: [rule] }))).toThrow();
    },
  );
  it("disables malformed regex configuration when loading", () => {
    const path = join(temp(), "state.json");
    writeFileSync(path, JSON.stringify({ enabled: true, models: ["/[/"] }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(Effect.runSync(loadState(path))).toEqual(emptyState());
    expect(warn).toHaveBeenCalledOnce();
  });
  it("starts disabled when absent and round-trips state through nested directories", () => {
    const path = join(temp(), "extensions", "pi-gpt.json");
    expect(Effect.runSync(loadState(path))).toEqual(emptyState());
    Effect.runSync(saveState(path, active));
    expect(Effect.runSync(loadState(path))).toEqual(active);
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual(active);
  });
  it("reports corrupt state and defaults to disabled", () => {
    const path = join(temp(), "state.json");
    writeFileSync(path, "{");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(Effect.runSync(loadState(path))).toEqual(emptyState());
    expect(warn).toHaveBeenCalledOnce();
  });
  it("returns a typed failure when saving fails", () => {
    const path = join(temp(), "file");
    writeFileSync(path, "occupied");
    expect(
      Effect.runSync(Effect.either(saveState(join(path, "state.json"), active))),
    ).toMatchObject({
      _tag: "Left",
    });
  });
});
