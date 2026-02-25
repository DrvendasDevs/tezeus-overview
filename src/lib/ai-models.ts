export type ReasoningEffort = "low" | "medium" | "high";

export const isReasoningEffortModel = (model?: string): boolean => {
  if (!model) return false;
  const match = model.match(/^gpt-(\d+)(?:\.(\d+))?/);
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2] ?? 0);
  if (Number.isNaN(major) || Number.isNaN(minor)) return false;
  return major > 5 || (major === 5 && minor >= 1);
};

export const getReasoningEffortLabel = (value?: ReasoningEffort | null) => {
  switch (value) {
    case "low":
      return "Baixo";
    case "medium":
      return "Médio";
    case "high":
      return "Alto";
    default:
      return "-";
  }
};
