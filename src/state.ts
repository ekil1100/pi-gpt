import { Schema } from "effect";

const isRegex = (rule: string): boolean => rule.startsWith("/");

const isValidRule = (rule: string): boolean => {
  if (!isRegex(rule)) return /^[^/\s]+\/[^\s]+$/.test(rule);
  if (rule.length < 3 || !rule.endsWith("/")) return false;
  try {
    new RegExp(rule.slice(1, -1));
    return true;
  } catch {
    return false;
  }
};

export const FastModeState = Schema.Struct({
  enabled: Schema.Boolean,
  models: Schema.Array(
    Schema.String.pipe(
      Schema.filter(isValidRule, {
        message: () => "Expected a provider/model identifier or a valid /regex/ rule.",
      }),
    ),
  ),
});
export type FastModeState = typeof FastModeState.Type;
export const emptyState = (): FastModeState => ({ enabled: false, models: [] });
export const decodeState = Schema.decodeUnknownSync(Schema.parseJson(FastModeState));

type Model = { readonly provider: string; readonly id: string } | undefined;
export const modelKey = (model: Model): string | undefined =>
  model ? `${model.provider}/${model.id}` : undefined;

const matchesModel = (rule: string, key: string): boolean =>
  isRegex(rule) ? new RegExp(rule.slice(1, -1)).test(key) : rule === key;

export const isActive = (state: FastModeState, model: Model): boolean => {
  const key = modelKey(model);
  return (
    state.enabled && key !== undefined && state.models.some((pattern) => matchesModel(pattern, key))
  );
};

export const transformRequest = (
  state: FastModeState,
  model: Model,
  payload: unknown,
): Record<string, unknown> | undefined =>
  isActive(state, model) &&
  typeof payload === "object" &&
  payload !== null &&
  !Array.isArray(payload)
    ? { ...payload, service_tier: "priority" }
    : undefined;

export const describeState = (state: FastModeState, model: Model): string => {
  const key = modelKey(model) ?? "no model";
  if (!state.enabled) return `Fast mode is off. Current model: ${key}.`;
  return isActive(state, model)
    ? `Fast mode is on for ${key}.`
    : `Fast mode is on, but ${key} is not listed in pi-gpt.json models.`;
};
