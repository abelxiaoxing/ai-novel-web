type NumericInput = number | string;

export type NumberValidationRule = {
  finite?: boolean;
  integer?: boolean;
  min?: number;
  label?: string;
};

const defaultRule: Required<Pick<NumberValidationRule, "finite" | "integer" | "label">> = {
  finite: true,
  integer: false,
  label: "数值",
};

const formatValidationMessage = (
  label: string,
  reason: "nan" | "infinite" | "integer" | "min",
  min?: number
): string => {
  switch (reason) {
    case "nan":
      return `${label}必须是有效数字`;
    case "infinite":
      return `${label}必须是有限数值`;
    case "integer":
      return `${label}必须是整数`;
    case "min":
      return `${label}必须大于或等于${min}`;
    default:
      return `${label}不合法`;
  }
};

export function toPayloadNumber(value: NumericInput, rule: NumberValidationRule = {}): number {
  const mergedRule = { ...defaultRule, ...rule };
  const numeric = Number(value);

  if (Number.isNaN(numeric)) {
    throw new Error(formatValidationMessage(mergedRule.label, "nan"));
  }

  if (mergedRule.finite && !Number.isFinite(numeric)) {
    throw new Error(formatValidationMessage(mergedRule.label, "infinite"));
  }

  if (mergedRule.integer && !Number.isInteger(numeric)) {
    throw new Error(formatValidationMessage(mergedRule.label, "integer"));
  }

  if (typeof mergedRule.min === "number" && numeric < mergedRule.min) {
    throw new Error(formatValidationMessage(mergedRule.label, "min", mergedRule.min));
  }

  return numeric;
}

export function resolveConfigName(primary?: string, fallback?: string): string | undefined {
  return primary || fallback || undefined;
}
