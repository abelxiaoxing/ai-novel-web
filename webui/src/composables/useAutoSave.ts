import { ref, watch, onUnmounted, type Ref } from "vue";

export type SaveStatus = "saved" | "unsaved" | "saving";

export interface UseAutoSaveOptions {
  /** Debounce delay in milliseconds (default: 3000) */
  debounceMs?: number;
  /** Callback to perform the save operation */
  onSave: () => Promise<void>;
  /** Optional callback when save succeeds */
  onSaveSuccess?: () => void;
  /** Optional callback when save fails */
  onSaveError?: (error: Error) => void;
}

export interface UseAutoSaveReturn {
  /** Current save status */
  saveStatus: Ref<SaveStatus>;
  /** Last saved content (for comparison) */
  lastSavedContent: Ref<string>;
  /** Trigger immediate save */
  saveNow: () => Promise<void>;
  /** Mark content as changed (triggers debounced auto-save) */
  markChanged: (newContent: string) => void;
  /** Reset to saved state with new content */
  resetWithContent: (content: string) => void;
  /** Check if there are unsaved changes */
  hasUnsavedChanges: Ref<boolean>;
}

/**
 * Composable for auto-save functionality with debouncing
 * 
 * Features:
 * - 3-second debounced auto-save (configurable)
 * - Save status tracking (saved/unsaved/saving)
 * - Immediate save support (for Ctrl+S)
 * - Unsaved changes detection
 */
export function useAutoSave(
  content: Ref<string>,
  options: UseAutoSaveOptions
): UseAutoSaveReturn {
  const { debounceMs = 3000, onSave, onSaveSuccess, onSaveError } = options;

  const saveStatus = ref<SaveStatus>("saved");
  const lastSavedContent = ref<string>(content.value);
  const hasUnsavedChanges = ref(false);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const clearDebounceTimer = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };

  const updateUnsavedState = () => {
    hasUnsavedChanges.value = content.value !== lastSavedContent.value;
    if (hasUnsavedChanges.value && saveStatus.value === "saved") {
      saveStatus.value = "unsaved";
    }
  };

  const performSave = async () => {
    if (!hasUnsavedChanges.value) {
      return;
    }

    saveStatus.value = "saving";
    try {
      await onSave();
      lastSavedContent.value = content.value;
      hasUnsavedChanges.value = false;
      saveStatus.value = "saved";
      onSaveSuccess?.();
    } catch (error) {
      saveStatus.value = "unsaved";
      onSaveError?.(error instanceof Error ? error : new Error(String(error)));
    }
  };

  const saveNow = async () => {
    clearDebounceTimer();
    await performSave();
  };

  const markChanged = (newContent: string) => {
    // Update unsaved state
    hasUnsavedChanges.value = newContent !== lastSavedContent.value;
    if (hasUnsavedChanges.value) {
      saveStatus.value = "unsaved";
    }

    // Reset debounce timer
    clearDebounceTimer();
    if (hasUnsavedChanges.value) {
      debounceTimer = setTimeout(() => {
        performSave();
      }, debounceMs);
    }
  };

  const resetWithContent = (newContent: string) => {
    clearDebounceTimer();
    lastSavedContent.value = newContent;
    hasUnsavedChanges.value = false;
    saveStatus.value = "saved";
  };

  // Watch for content changes
  watch(
    content,
    (newValue) => {
      markChanged(newValue);
    },
    { immediate: false }
  );

  // Cleanup on unmount
  onUnmounted(() => {
    clearDebounceTimer();
  });

  return {
    saveStatus,
    lastSavedContent,
    saveNow,
    markChanged,
    resetWithContent,
    hasUnsavedChanges,
  };
}
