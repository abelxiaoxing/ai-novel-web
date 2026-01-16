import { defineStore } from "pinia";

export type PanelId = "sidebar" | "rightPanel" | "bottomPanel";

export interface PanelState {
  sidebar: boolean;
  rightPanel: boolean;
  bottomPanel: boolean;
}

export const usePanelStore = defineStore("panel", {
  state: (): PanelState => ({
    sidebar: true,
    rightPanel: true,
    bottomPanel: true,
  }),

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
  },
});
