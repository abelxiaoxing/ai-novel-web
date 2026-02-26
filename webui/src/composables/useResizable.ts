import { ref, onBeforeUnmount, type Ref } from "vue";

export type ResizeDirection = "horizontal" | "vertical";

export interface ResizableOptions {
  direction: ResizeDirection;
  initialSize: number;
  minSize?: number;
  maxSize?: number;
  onResize: (size: number) => void;
  reverse?: boolean;
  getCurrentSize?: () => number;
  onResizeEnd?: (size: number) => void;
}

export interface ResizableReturn {
  isResizing: Ref<boolean>;
  startResize: (e: MouseEvent) => void;
  handleClass: string;
}

export function useResizable(options: ResizableOptions): ResizableReturn {
  const isResizing = ref(false);
  const startPos = ref(0);
  const startSize = ref(0);
  const pendingSize = ref<number | null>(null);
  const lastSize = ref<number | null>(null);
  const rafId = ref<number | null>(null);

  const minSize = options.minSize ?? 80;
  const maxSize = options.maxSize ?? 500;
  const reverse = options.reverse ?? false;

  const flushPendingResize = () => {
    if (rafId.value !== null) {
      return;
    }
    rafId.value = window.requestAnimationFrame(() => {
      rafId.value = null;
      if (pendingSize.value === null) {
        return;
      }
      const nextSize = pendingSize.value;
      pendingSize.value = null;
      if (lastSize.value === nextSize) {
        return;
      }
      lastSize.value = nextSize;
      options.onResize(nextSize);
    });
  };

  const clearPendingFrame = () => {
    if (rafId.value !== null) {
      window.cancelAnimationFrame(rafId.value);
      rafId.value = null;
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.value) return;

    const delta = options.direction === "horizontal"
      ? e.clientX - startPos.value
      : e.clientY - startPos.value;

    const actualDelta = reverse ? -delta : delta;
    let newSize = startSize.value + actualDelta;

    newSize = Math.max(minSize, Math.min(maxSize, newSize));

    if (pendingSize.value === newSize || lastSize.value === newSize) {
      return;
    }

    pendingSize.value = newSize;
    flushPendingResize();
  };

  const handleMouseUp = () => {
    if (!isResizing.value) return;

    isResizing.value = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);

    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    document.body.classList.remove("panel-resizing");

    clearPendingFrame();

    const finalSize = pendingSize.value ?? lastSize.value ?? startSize.value;
    pendingSize.value = null;

    if (lastSize.value !== finalSize) {
      lastSize.value = finalSize;
      options.onResize(finalSize);
    }

    options.onResizeEnd?.(finalSize);
  };

  const startResize = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    isResizing.value = true;
    startPos.value = options.direction === "horizontal" ? e.clientX : e.clientY;
    startSize.value = options.getCurrentSize?.() ?? options.initialSize;
    lastSize.value = startSize.value;
    pendingSize.value = null;

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    document.body.style.cursor = options.direction === "horizontal" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
    document.body.classList.add("panel-resizing");
  };

  onBeforeUnmount(() => {
    if (isResizing.value) {
      handleMouseUp();
    }
    clearPendingFrame();
  });

  const handleClass = options.direction === "horizontal"
    ? "resize-handle resize-handle--horizontal"
    : "resize-handle resize-handle--vertical";

  return {
    isResizing,
    startResize,
    handleClass,
  };
}
