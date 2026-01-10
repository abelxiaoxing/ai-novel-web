import { ref, watch, computed, type Ref } from "vue";
import { getChapterInfoFromBlueprint, createDefaultChapterInfo, type ChapterInfo } from "@/utils/chapterParser";

export interface UseChapterInfoOptions {
  /** The current chapter number (reactive) */
  chapterNumber: Ref<number>;
  /** The blueprint content (reactive) */
  blueprintContent: Ref<string>;
  /** Callback when chapter info is auto-filled */
  onAutoFill?: (info: ChapterInfo) => void;
}

export interface UseChapterInfoReturn {
  /** The current chapter info (parsed from blueprint) */
  chapterInfo: Ref<ChapterInfo | null>;
  /** Whether the current values have been manually overridden */
  isManuallyOverridden: Ref<boolean>;
  /** Characters string for form field */
  charactersString: Ref<string>;
  /** Scenes string for form field */
  scenesString: Ref<string>;
  /** Mark the current values as manually overridden */
  markAsOverridden: () => void;
  /** Reset override flag and re-apply auto-fill */
  resetOverride: () => void;
  /** Get auto-fill values for form fields */
  getAutoFillValues: () => {
    charactersInvolved: string;
    sceneLocation: string;
  };
}

/**
 * Composable for managing chapter info auto-fill from blueprint
 * 
 * Features:
 * - Watches chapter number changes and extracts info from blueprint
 * - Supports manual override (user edits won't be overwritten)
 * - Provides formatted strings for form fields
 */
export function useChapterInfo(options: UseChapterInfoOptions): UseChapterInfoReturn {
  const { chapterNumber, blueprintContent, onAutoFill } = options;

  const chapterInfo = ref<ChapterInfo | null>(null);
  const isManuallyOverridden = ref(false);

  // Computed strings for form fields
  const charactersString = computed(() => {
    if (!chapterInfo.value) {
      return "";
    }
    return chapterInfo.value.characters.join("、");
  });

  const scenesString = computed(() => {
    if (!chapterInfo.value) {
      return "";
    }
    return chapterInfo.value.scenes.join("、");
  });

  // Watch chapter number changes
  watch(
    [chapterNumber, blueprintContent],
    ([newChapterNum, newBlueprint]) => {
      if (!newBlueprint || newChapterNum <= 0) {
        chapterInfo.value = null;
        return;
      }

      const info = getChapterInfoFromBlueprint(newBlueprint, newChapterNum);
      
      if (info) {
        chapterInfo.value = info;
        
        // Only auto-fill if not manually overridden
        if (!isManuallyOverridden.value && onAutoFill) {
          onAutoFill(info);
        }
      } else {
        chapterInfo.value = createDefaultChapterInfo(newChapterNum);
      }
    },
    { immediate: true }
  );

  // Reset override flag when chapter number changes
  watch(chapterNumber, () => {
    isManuallyOverridden.value = false;
  });

  const markAsOverridden = () => {
    isManuallyOverridden.value = true;
  };

  const resetOverride = () => {
    isManuallyOverridden.value = false;
    // Re-trigger auto-fill
    if (chapterInfo.value && onAutoFill) {
      onAutoFill(chapterInfo.value);
    }
  };

  const getAutoFillValues = () => {
    return {
      charactersInvolved: charactersString.value,
      sceneLocation: scenesString.value,
    };
  };

  return {
    chapterInfo,
    isManuallyOverridden,
    charactersString,
    scenesString,
    markAsOverridden,
    resetOverride,
    getAutoFillValues,
  };
}
