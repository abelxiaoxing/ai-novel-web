import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { toPayloadNumber } from "@/composables/workbenchPayloadHelpers";

const integerRule = {
  integer: true,
  finite: true,
  min: 1,
  label: "章节号",
} as const;

describe("workbenchPayloadHelpers 属性测试", () => {
  it("对非法字符串、NaN、Infinity、负数进行拒绝", async () => {
    const invalidStringArb = fc
      .string({ minLength: 1, maxLength: 12 })
      .filter((value) => !/^\d+$/.test(value.trim()));

    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          invalidStringArb,
          fc.constantFrom("NaN", "Infinity", "-Infinity", " ", "abc", "1e999"),
          fc.constant(Number.NaN),
          fc.constant(Number.POSITIVE_INFINITY),
          fc.constant(Number.NEGATIVE_INFINITY),
          fc.integer({ max: 0 }),
          fc.double({ noNaN: true, noDefaultInfinity: true }).filter((value) => !Number.isInteger(value) || value < 1)
        ),
        async (invalidValue) => {
          expect(() => toPayloadNumber(invalidValue as number | string, integerRule)).toThrow();
        }
      ),
      { numRuns: 120 }
    );
  });

  it("对大于等于1的整数可稳定通过", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 10000 }), async (value) => {
        expect(toPayloadNumber(String(value), integerRule)).toBe(value);
        expect(toPayloadNumber(value, integerRule)).toBe(value);
      }),
      { numRuns: 80 }
    );
  });
});
