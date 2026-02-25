import { ref, onBeforeUnmount, type Ref } from "vue";

export type ResizeDirection = "horizontal" | "vertical";

export interface ResizableOptions {
  /** 拖拽方向 */
  direction: ResizeDirection;
  /** 初始尺寸 */
  initialSize: number;
  /** 最小尺寸 */
  minSize?: number;
  /** 最大尺寸 */
  maxSize?: number;
  /** 尺寸变化回调 */
  onResize: (size: number) => void;
  /** 是否反向拖拽（向右/向下拖拽时尺寸减小） */
  reverse?: boolean;
}

export interface ResizableReturn {
  /** 是否正在拖拽 */
  isResizing: Ref<boolean>;
  /** 开始拖拽 */
  startResize: (e: MouseEvent) => void;
  /** 手柄样式类 */
  handleClass: string;
}

/**
 * 面板大小调整组合式函数
 * @param options 配置选项
 * @returns 拖拽控制方法和状态
 */
export function useResizable(options: ResizableOptions): ResizableReturn {
  const isResizing = ref(false);
  const startPos = ref(0);
  const startSize = ref(0);

  const minSize = options.minSize ?? 80;
  const maxSize = options.maxSize ?? 500;
  const reverse = options.reverse ?? false;

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.value) return;

    const delta = options.direction === "horizontal"
      ? e.clientX - startPos.value
      : e.clientY - startPos.value;

    const actualDelta = reverse ? -delta : delta;
    let newSize = startSize.value + actualDelta;

    // 应用边界限制
    newSize = Math.max(minSize, Math.min(maxSize, newSize));

    options.onResize(newSize);
  };

  const handleMouseUp = () => {
    if (!isResizing.value) return;

    isResizing.value = false;

    // 移除全局事件监听
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);

    // 恢复默认光标
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  const startResize = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    isResizing.value = true;
    startPos.value = options.direction === "horizontal" ? e.clientX : e.clientY;
    startSize.value = options.initialSize;

    // 添加全局事件监听
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    // 设置拖拽时的光标样式
    document.body.style.cursor = options.direction === "horizontal" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
  };

  // 组件卸载时清理事件监听
  onBeforeUnmount(() => {
    if (isResizing.value) {
      handleMouseUp();
    }
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
