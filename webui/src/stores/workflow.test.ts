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
    expect(store.currentChapter).toBe(1);
    expect(store.chapterStatuses).toEqual({});
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
    expect(store.chapterStatuses).toEqual({});
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

  it("should set chapter status", () => {
    const store = useWorkflowStore();

    store.setChapterStatus(1, "draft-pending");

    expect(store.chapterStatuses[1]?.status).toBe("draft-pending");
  });

  it("should finalize chapter", () => {
    const store = useWorkflowStore();
    store.setCurrentChapter(1);

    store.finalizeChapter();

    expect(store.chapterStatuses[1]?.status).toBe("finalized");
  });

  it("should get chapter status label", () => {
    const store = useWorkflowStore();
    store.setCurrentChapter(1);

    // Not started
    expect(store.getChapterStatusLabel.label).toBe("○ 未开始");
    expect(store.getChapterStatusLabel.variant).toBe("muted");

    // Draft pending
    store.setChapterStatus(1, "draft-pending");
    expect(store.getChapterStatusLabel.label).toBe("● 草稿待定稿");
    expect(store.getChapterStatusLabel.variant).toBe("warning");

    // Finalized
    store.finalizeChapter();
    expect(store.getChapterStatusLabel.label).toBe("✓ 已定稿");
    expect(store.getChapterStatusLabel.variant).toBe("success");
  });
});

describe("computeButtonStates", () => {
  it("should disable blueprint when no architecture", () => {
    const states = computeButtonStates({
      hasArchitecture: false,
      hasBlueprint: false,
      currentChapter: 1,
      chapterStatuses: {},
      totalChapters: 10,
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
      currentChapter: 1,
      chapterStatuses: {},
      totalChapters: 10,
    });

    expect(states.blueprintDisabled).toBe(false);
    expect(states.draftDisabled).toBe(true);
  });

  it("should enable draft when blueprint exists", () => {
    const states = computeButtonStates({
      hasArchitecture: true,
      hasBlueprint: true,
      currentChapter: 1,
      chapterStatuses: {},
      totalChapters: 10,
    });

    expect(states.draftDisabled).toBe(false);
  });

  it("should disable finalize when no draft", () => {
    const states = computeButtonStates({
      hasArchitecture: true,
      hasBlueprint: true,
      currentChapter: 1,
      chapterStatuses: {},
      totalChapters: 10,
    });

    expect(states.finalizeDisabled).toBe(true);
    expect(states.finalizeDisabledReason).toBe("请先生成草稿");
  });

  it("should enable finalize when draft exists", () => {
    const states = computeButtonStates({
      hasArchitecture: true,
      hasBlueprint: true,
      currentChapter: 1,
      chapterStatuses: { 1: { status: "draft-pending" } },
      totalChapters: 10,
    });

    expect(states.finalizeDisabled).toBe(false);
  });

  it("should disable draft when previous chapter not finalized", () => {
    const states = computeButtonStates({
      hasArchitecture: true,
      hasBlueprint: true,
      currentChapter: 2,
      chapterStatuses: {},
      totalChapters: 10,
    });

    expect(states.draftDisabled).toBe(true);
    expect(states.draftDisabledReason).toBe("请先定稿第 1 章");
  });

  it("should enable draft when previous chapter is finalized", () => {
    const states = computeButtonStates({
      hasArchitecture: true,
      hasBlueprint: true,
      currentChapter: 2,
      chapterStatuses: { 1: { status: "finalized" } },
      totalChapters: 10,
    });

    expect(states.draftDisabled).toBe(false);
    expect(states.draftDisabledReason).toBe(null);
  });
});
