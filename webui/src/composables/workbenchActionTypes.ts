export const WORKBENCH_ACTIONS = [
  "architecture",
  "blueprint",
  "preview-prompt",
  "batch",
  "draft",
  "finalize",
  "consistency",
] as const;

export type WorkbenchAction = (typeof WORKBENCH_ACTIONS)[number];

export type TaskActionMeta = {
  action: WorkbenchAction;
  chapterNumber?: number;
  sessionId?: number;
};

export type TerminalTask = {
  id: string;
  label: string;
  status: "success" | "failed" | "cancelled";
  handled?: boolean;
  outputFiles?: string[];
  error?: string;
  result?: Record<string, unknown>;
};
