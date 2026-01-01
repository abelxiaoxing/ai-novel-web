import { defineStore } from "pinia";
import { getChooseConfigs, getEmbeddingConfigs, getLlmConfigs } from "@/api/config";

function extractNames(payload: Record<string, unknown> | undefined) {
  if (!payload) {
    return [] as string[];
  }
  if (Array.isArray(payload)) {
    return payload.map(String);
  }
  if ("configs" in payload && typeof payload.configs === "object") {
    return Object.keys(payload.configs as Record<string, unknown>);
  }
  return Object.keys(payload);
}

export const useConfigStore = defineStore("config", {
  state: () => ({
    llmConfigs: [] as string[],
    embeddingConfigs: [] as string[],
    chooseConfigs: {} as Record<string, string>,
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async fetchConfigs() {
      this.loading = true;
      this.error = null;
      try {
        const [llmPayload, embeddingPayload, choosePayload] = await Promise.all([
          getLlmConfigs(),
          getEmbeddingConfigs(),
          getChooseConfigs(),
        ]);

        this.llmConfigs = extractNames(llmPayload as Record<string, unknown>);
        this.embeddingConfigs = extractNames(embeddingPayload as Record<string, unknown>);

        if (choosePayload && typeof choosePayload === "object") {
          if ("choose_configs" in choosePayload) {
            this.chooseConfigs =
              (choosePayload as { choose_configs?: Record<string, string> }).choose_configs ??
              {};
          } else {
            this.chooseConfigs = choosePayload as Record<string, string>;
          }
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : "加载配置失败";
      } finally {
        this.loading = false;
      }
    },
  },
});
