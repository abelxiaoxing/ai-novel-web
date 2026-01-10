<template>
  <Teleport to="body">
    <div class="context-backdrop" @click="$emit('close')" @contextmenu.prevent>
      <div class="context-menu" :style="{ left: `${x}px`, top: `${y}px` }" @click.stop>
        <button
          v-for="item in items"
          :key="item.key"
          class="context-item"
          :disabled="item.disabled"
          @click="$emit('select', item.key)"
        >
          {{ item.label }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
export type ContextMenuItem = {
  key: string;
  label: string;
  disabled?: boolean;
};

defineProps<{
  x: number;
  y: number;
  items: ContextMenuItem[];
}>();

defineEmits<{
  (event: "select", key: string): void;
  (event: "close"): void;
}>();
</script>

<style scoped>
.context-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
}

.context-menu {
  position: absolute;
  min-width: 160px;
  padding: 6px;
  background: var(--panel-strong);
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  box-shadow: var(--shadow-soft);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.context-item {
  padding: 8px 10px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text);
  text-align: left;
  cursor: pointer;
  font-size: 13px;
}

.context-item:hover:not(:disabled) {
  background: rgba(126, 91, 255, 0.18);
}

.context-item:disabled {
  color: rgba(185, 176, 214, 0.4);
  cursor: not-allowed;
}
</style>
