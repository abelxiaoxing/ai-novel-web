import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { setActivePinia, createPinia } from "pinia";
import { WORKFLOW_STEPS, computeButtonStates, useWorkflowStore } from "./workflow";

describe("Workflow Store Properties", () => {
  it("advances to the next step after completing ordered steps", () => {
    const steps = WORKFLOW_STEPS.map((step) => step.key);
    fc.assert(
      fc.property(fc.integer({ min: 1, max: steps.length }), (count) => {
        setActivePinia(createPinia());
        const store = useWorkflowStore();
        for (let i = 0; i < count; i++) {
          store.completeStep(steps[i]);
        }
        const expected = count < steps.length ? steps[count] : steps[steps.length - 1];
        expect(store.currentStep).toBe(expected);
      })
    );
  });

  it("derives button disabled states from prerequisites", () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), (hasArchitecture, hasBlueprint) => {
        const states = computeButtonStates({
          hasArchitecture,
          hasBlueprint,
          currentChapter: 1,
          chapterStatuses: {},
          totalChapters: 10,
        });
        expect(states.blueprintDisabled).toBe(!hasArchitecture);
        expect(states.draftDisabled).toBe(!hasBlueprint);
        expect(states.finalizeDisabled).toBe(true); // No draft by default
      })
    );
  });

  it("enables finalize when draft exists", () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), (hasArchitecture, hasBlueprint) => {
        const states = computeButtonStates({
          hasArchitecture,
          hasBlueprint,
          currentChapter: 1,
          chapterStatuses: { 1: { status: "draft-pending" } },
          totalChapters: 10,
        });
        expect(states.finalizeDisabled).toBe(false);
      })
    );
  });

  it("increments chapters until reaching the total", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),
        fc.integer({ min: 1, max: 30 }),
        (total, current) => {
          setActivePinia(createPinia());
          const store = useWorkflowStore();
          store.setTotalChapters(total);
          store.setCurrentChapter(current);
          const didIncrement = store.incrementChapter();
          if (current < total) {
            expect(didIncrement).toBe(true);
            expect(store.currentChapter).toBe(current + 1);
          } else {
            expect(didIncrement).toBe(false);
            expect(store.currentChapter).toBe(Math.min(current, total));
          }
        }
      )
    );
  });
});
