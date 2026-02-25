import { defineStore } from "pinia";

export type PanelId = "sidebar" | "rightPanel" | "bottomPanel";

export interface PanelState {
  sidebar: boolean;
  rightPanel: boolean;
  bottomPanel: boolean;
  sidebarWidth: number;
  rightPanelWidth: number;
  bottomPanelHeight: number;
}

const STORAGE_KEY = "ainovel:panel-sizes";

const loadSizesFromStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // ignore
  }
  return null;
};

const saveSizesToStorage = (sizes: { sidebarWidth: number; rightPanelWidth: number; bottomPanelHeight: number }) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes));
  } catch {
    // ignore
  }
};

export const usePanelStore = defineStore("panel", {
  state: (): PanelState => {
    const saved = loadSizesFromStorage();
    return {
      sidebar: true,
      rightPanel: true,
      bottomPanel: true,
      sidebarWidth: saved?.sidebarWidth ?? 120,
      rightPanelWidth: saved?.rightPanelWidth ?? 152,
      bottomPanelHeight: saved?.bottomPanelHeight ?? 190,
    };
  },

  getters: {
    /**
     * 获取 CSS Grid 类名，用于动态调整布局
     */
    gridClass(): string {
      const parts: string[] = [];
      if (!this.sidebar) parts.push("no-sidebar");
      if (!this.rightPanel) parts.push("no-right-panel");
      if (!this.bottomPanel) parts.push("no-bottom-panel");
      return parts.join(" ");
    },
  },

  actions: {
    /**
     * 切换面板的显示/隐藏状态
     */
    toggle(panelId: PanelId): void {
      this[panelId] = !this[panelId];
    },

    /**
     * 设置面板的显示状态
     */
    setPanel(panelId: PanelId, visible: boolean): void {
      this[panelId] = visible;
    },

    /**
     * 显示所有面板
     */
    showAll(): void {
      this.sidebar = true;
      this.rightPanel = true;
      this.bottomPanel = true;
    },

    /**
     * 隐藏所有面板
     */
    hideAll(): void {
      this.sidebar = false;
      this.rightPanel = false;
      this.bottomPanel = false;
    },

    /**
     * 更新面板尺寸
     */
    updateSize(type: "sidebar" | "rightPanel" | "bottomPanel", value: number): void {
      const minWidth = 80;
      const maxWidth = 400;
      const minHeight = 80;
      const maxHeight = 500;

      if (type === "sidebar") {
        this.sidebarWidth = Math.max(minWidth, Math.min(maxWidth, value));
      } else if (type === "rightPanel") {
        this.rightPanelWidth = Math.max(minWidth, Math.min(maxWidth, value));
      } else if (type === "bottomPanel") {
        this.bottomPanelHeight = Math.max(minHeight, Math.min(maxHeight, value));
      }

      // 保存到localStorage
      saveSizesToStorage({
        sidebarWidth: this.sidebarWidth,
        rightPanelWidth: this.rightPanelWidth,
        bottomPanelHeight: this.bottomPanelHeight,
      });
    },

    /**
     * 重置面板尺寸
     */
    resetSizes(): void {
      this.sidebarWidth = 120;
      this.rightPanelWidth = 152;
      this.bottomPanelHeight = 190;
      saveSizesToStorage({
        sidebarWidth: this.sidebarWidth,
        rightPanelWidth: this.rightPanelWidth,
        bottomPanelHeight: this.bottomPanelHeight,
      });
    },
  },
});
