<template>
  <aside class="activity-bar panel">
    <button
      v-for="item in items"
      :key="item.key"
      class="activity-button"
      :class="{ active: activeKey === item.key }"
      @click="$emit('select', item.key)"
      :title="item.label"
    >
      <span class="icon" v-html="item.icon"></span>
    </button>
  </aside>
</template>

<script setup lang="ts">
const items = [
  {
    key: "workspace",
    label: "工作区",
    icon: "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.6'><path d='M4 5h6l2 2h8v12H4z'/></svg>",
  },
  {
    key: "files",
    label: "文件",
    icon: "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.6'><path d='M6 4h9l3 3v13H6z'/><path d='M9 12h6M9 16h6'/></svg>",
  },
  {
    key: "settings",
    label: "设置",
    icon: "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.6'><circle cx='12' cy='12' r='3'/><path d='M19.4 15a1.8 1.8 0 0 0 .3 2l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.8 1.8 0 0 0-2-.3 1.8 1.8 0 0 0-1 1.6V22a2 2 0 1 1-4 0v-.1a1.8 1.8 0 0 0-1-1.6 1.8 1.8 0 0 0-2 .3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.8 1.8 0 0 0 .3-2 1.8 1.8 0 0 0-1.6-1H2a2 2 0 1 1 0-4h.1a1.8 1.8 0 0 0 1.6-1 1.8 1.8 0 0 0-.3-2l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.8 1.8 0 0 0 2 .3H9a1.8 1.8 0 0 0 1-1.6V2a2 2 0 1 1 4 0v.1a1.8 1.8 0 0 0 1 1.6 1.8 1.8 0 0 0 2-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.8 1.8 0 0 0-.3 2v.1a1.8 1.8 0 0 0 1.6 1H22a2 2 0 1 1 0 4h-.1a1.8 1.8 0 0 0-1.6 1z'/></svg>",
  },
];

defineProps<{ activeKey: string }>();

defineEmits(["select"]);
</script>

<style scoped>
.activity-bar {
  grid-column: 1 / 2;
  grid-row: 2 / 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 16px 0;
}

.activity-button {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: transparent;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.activity-button.active {
  background: rgba(126, 91, 255, 0.2);
  color: var(--accent-bright);
  border-color: rgba(126, 91, 255, 0.4);
}

.activity-button:hover {
  color: var(--text);
}

.icon {
  width: 20px;
  height: 20px;
}

.icon :deep(svg) {
  width: 100%;
  height: 100%;
}
</style>
