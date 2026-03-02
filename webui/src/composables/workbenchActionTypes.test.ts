import { describe, it, expect } from "vitest";
import { WORKBENCH_ACTIONS, type WorkbenchAction } from "@/composables/workbenchActionTypes";

describe("workbenchActionTypes", () => {
  it("exports all supported workbench actions in stable order", () => {
    expect(WORKBENCH_ACTIONS).toEqual([
      "architecture",
      "blueprint",
      "batch",
      "draft",
      "finalize",
      "consistency",
    ]);
  });

  it("contains no duplicated action names", () => {
    expect(new Set(WORKBENCH_ACTIONS).size).toBe(WORKBENCH_ACTIONS.length);
  });

  it("is consumable as WorkbenchAction union", () => {
    const action: WorkbenchAction = WORKBENCH_ACTIONS[0];
    expect(typeof action).toBe("string");
  });
});
