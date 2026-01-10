import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useWorkflowStore, computeButtonStates } from "./workflow";

describe("Workflow Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("should initialize with default state", () => {
    const store = useWorkflowStore();
    
    expect(store.currentStep).toBe("architecture");
    expect(store.completedSteps).toEqual([]);
    expect(store.hasArchitecture).toBe(false);
    expect(store.hasBlueprint).toBe(false);
  });

  it("should complete a step and advance to next", () => {
    const store = useWorkflowStore();
    
    store.completeStep("architecture");
    
    expect(store.completedSteps).toContain("architecture");
    expect(store.hasArchitecture).toBe(true);
    expect(store.currentStep).toBe("blueprint");
  });

  it("should check prerequisites correctly", () => {
    const store = useWorkflowStore();
    
    // Architecture has no prerequisite
    expect(store.isPrerequisiteMet("architecture")).toBe(true);
    // Blueprint requires architecture
    expect(store.isPrerequisiteMet("blueprint")).toBe(false);
    
    store.completeStep("architecture");
    expect(store.isPrerequisiteMet("blueprint")).toBe(true);
  });

  it("should reset workflow state", () => {
    const store = useWorkflowStore();
    
    store.completeStep("architecture");
    store.completeStep("blueprint");
    store.setCurrentChapter(5);
    
    store.reset();
    
    expect(store.currentStep).toBe("architecture");
    expect(store.completedSteps).toEqual([]);
    expect(store.hasArchitecture).toBe(false);
    expect(store.hasBlueprint).toBe(false);
    expect(store.currentChapter).toBe(1);
  });

  it("should increment chapter correctly", () => {
    const store = useWorkflowStore();
    store.setTotalChapters(10);
    
    const result = store.incrementChapter();
    
    expect(result).toBe(true);
    expect(store.currentChapter).toBe(2);
  });

  it("should not increment chapter beyond total", () => {
    const store = useWorkflowStore();
    store.setTotalChapters(3);
    store.setCurrentChapter(3);
    
    const result = store.incrementChapter();
    
    expect(result).toBe(false);
    expect(store.currentChapter).toBe(3);
  });
});

describe("computeButtonStates", () => {
  it("should disable blueprint when no architecture", () => {
    const states = computeButtonStates({
      hasArchitecture: false,
      hasBlueprint: false,
    });
    
    expect(states.architectureDisabled).toBe(false);
    expect(states.blueprintDisabled).toBe(true);
    expect(states.draftDisabled).toBe(true);
    expect(states.finalizeDisabled).toBe(true);
  });

  it("should enable blueprint when architecture exists", () => {
    const states = computeButtonStates({
      hasArchitecture: true,
      hasBlueprint: false,
    });
    
    expect(states.blueprintDisabled).toBe(false);
    expect(states.draftDisabled).toBe(true);
  });

  it("should enable draft when blueprint exists", () => {
    const states = computeButtonStates({
      hasArchitecture: true,
      hasBlueprint: true,
    });
    
    expect(states.draftDisabled).toBe(false);
  });

  it("should disable finalize when no draft", () => {
    const states = computeButtonStates({
      hasArchitecture: true,
      hasBlueprint: true,
      hasDraft: false,
    });

    expect(states.finalizeDisabled).toBe(true);
  });

  it("should enable finalize when draft exists", () => {
    const states = computeButtonStates({
      hasArchitecture: true,
      hasBlueprint: true,
      hasDraft: true,
    });

    expect(states.finalizeDisabled).toBe(false);
  });
});
