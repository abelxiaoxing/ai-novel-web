import { describe, it, expect } from "vitest";
import { toPayloadNumber } from "@/composables/workbenchPayloadHelpers";

describe("workbenchPayloadHelpers", () => {
  it("parses valid integer payload numbers with min constraint", () => {
    expect(toPayloadNumber("1", { integer: true, min: 1, label: "章节号" })).toBe(1);
    expect(toPayloadNumber(5, { integer: true, min: 1, label: "目标字数" })).toBe(5);
  });

  it("throws with labeled message when value is NaN", () => {
    expect(() => toPayloadNumber("abc", { integer: true, min: 1, label: "章节号" })).toThrowError(
      "章节号必须是有效数字"
    );
  });

  it("throws with labeled message when value is infinite", () => {
    expect(() => toPayloadNumber(Number.POSITIVE_INFINITY, { integer: true, min: 1, label: "目标字数" })).toThrowError(
      "目标字数必须是有限数值"
    );
  });

  it("throws with labeled message when value is not integer", () => {
    expect(() => toPayloadNumber(1.2, { integer: true, min: 1, label: "章节总数" })).toThrowError(
      "章节总数必须是整数"
    );
  });

  it("throws with labeled message when value is below min", () => {
    expect(() => toPayloadNumber(0, { integer: true, min: 1, label: "章节号" })).toThrowError(
      "章节号必须大于或等于1"
    );
  });
});
