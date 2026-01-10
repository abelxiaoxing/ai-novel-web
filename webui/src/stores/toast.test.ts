import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useToastStore } from "./toast";

describe("Toast Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("should add a toast", () => {
    const store = useToastStore();
    const id = store.addToast("success", "Test message");
    
    expect(store.toasts).toHaveLength(1);
    expect(store.toasts[0].id).toBe(id);
    expect(store.toasts[0].message).toBe("Test message");
    expect(store.toasts[0].type).toBe("success");
  });

  it("should remove a toast by id", () => {
    const store = useToastStore();
    const id = store.addToast("info", "Test");
    
    expect(store.toasts).toHaveLength(1);
    store.removeToast(id);
    expect(store.toasts).toHaveLength(0);
  });

  it("should limit toasts to maxToasts", () => {
    const store = useToastStore();
    
    for (let i = 0; i < 10; i++) {
      store.addToast("info", `Message ${i}`);
    }
    
    expect(store.toasts.length).toBeLessThanOrEqual(store.maxToasts);
  });

  it("should set critical errors to not auto-dismiss (duration 0)", () => {
    const store = useToastStore();
    store.error("Critical error", true);
    
    expect(store.toasts[0].critical).toBe(true);
    expect(store.toasts[0].duration).toBe(0);
  });

  it("should clear all toasts", () => {
    const store = useToastStore();
    store.success("Message 1");
    store.error("Message 2");
    store.warning("Message 3");
    
    expect(store.toasts).toHaveLength(3);
    store.clearAll();
    expect(store.toasts).toHaveLength(0);
  });
});
