import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import EditorPane from "./EditorPane.vue";

describe("EditorPane", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("章节模式下每个非空行都应用缩进样式", () => {
    const wrapper = mount(EditorPane, {
      props: {
        title: "章节",
        content: "第一段正文\n\n第二段正文",
        activeFile: {
          path: "chapter:1",
          name: "第1章",
          kind: "chapter",
          chapterNumber: 1,
        },
      },
    });

    const previews = wrapper.findAll(".chapter-line-preview");
    expect(previews.length).toBe(3);
    expect(previews[0].classes()).toContain("chapter-line-preview--first");
    expect(previews[1].classes()).not.toContain("chapter-line-preview--first");
    expect(previews[2].classes()).toContain("chapter-line-preview--first");
    wrapper.unmount();
  });

  it("单击行进入编辑，并回写整章内容", async () => {
    const wrapper = mount(EditorPane, {
      props: {
        title: "章节",
        content: "第一行\n第二行",
        activeFile: {
          path: "chapter:1",
          name: "第1章",
          kind: "chapter",
          chapterNumber: 1,
        },
      },
    });

    await wrapper.findAll(".chapter-line-preview")[0].trigger("click");
    await nextTick();

    const editor = wrapper.find("textarea.chapter-line-editor");
    expect(editor.exists()).toBe(true);
    await editor.setValue("改后第一行");

    const emits = wrapper.emitted("update:content") ?? [];
    expect(emits.length).toBeGreaterThan(0);
    expect(emits[emits.length - 1]?.[0]).toBe("改后第一行\n第二行");
    wrapper.unmount();
  });

  it("章节行内粘贴多行文本时应保留换行并插入为新行", async () => {
    const wrapper = mount(EditorPane, {
      props: {
        title: "章节",
        content: "第一行\n第二行",
        activeFile: {
          path: "chapter:1",
          name: "第1章",
          kind: "chapter",
          chapterNumber: 1,
        },
      },
    });

    await wrapper.findAll(".chapter-line-preview")[0].trigger("click");
    await nextTick();

    const editor = wrapper.find("textarea.chapter-line-editor");
    await editor.setValue("改后第一行\n新增第二行");
    await nextTick();

    const emits = wrapper.emitted("update:content") ?? [];
    expect(emits.length).toBeGreaterThan(0);
    expect(emits[emits.length - 1]?.[0]).toBe("改后第一行\n新增第二行\n第二行");
    expect(wrapper.find("textarea.chapter-line-editor").element.value).toBe("新增第二行");
    wrapper.unmount();
  });

  it("章节行首按 Backspace 应与上一行合并", async () => {
    const wrapper = mount(EditorPane, {
      props: {
        title: "章节",
        content: "第一行\n第二行",
        activeFile: {
          path: "chapter:1",
          name: "第1章",
          kind: "chapter",
          chapterNumber: 1,
        },
      },
    });

    await wrapper.findAll(".chapter-line-preview")[1].trigger("click");
    await nextTick();

    const editor = wrapper.find("textarea.chapter-line-editor");
    const input = editor.element as HTMLTextAreaElement;
    input.setSelectionRange(0, 0);
    await editor.trigger("keydown", { key: "Backspace" });
    await nextTick();

    const emits = wrapper.emitted("update:content") ?? [];
    expect(emits.length).toBeGreaterThan(0);
    expect(emits[emits.length - 1]?.[0]).toBe("第一行第二行");
    expect(wrapper.find("textarea.chapter-line-editor").element.value).toBe("第一行第二行");
    wrapper.unmount();
  });

  it("章节行尾按 Delete 应与下一行合并", async () => {
    const wrapper = mount(EditorPane, {
      props: {
        title: "章节",
        content: "第一行\n第二行",
        activeFile: {
          path: "chapter:1",
          name: "第1章",
          kind: "chapter",
          chapterNumber: 1,
        },
      },
    });

    await wrapper.findAll(".chapter-line-preview")[0].trigger("click");
    await nextTick();

    const editor = wrapper.find("textarea.chapter-line-editor");
    const input = editor.element as HTMLTextAreaElement;
    const end = input.value.length;
    input.setSelectionRange(end, end);
    await editor.trigger("keydown", { key: "Delete" });
    await nextTick();

    const emits = wrapper.emitted("update:content") ?? [];
    expect(emits.length).toBeGreaterThan(0);
    expect(emits[emits.length - 1]?.[0]).toBe("第一行第二行");
    expect(wrapper.find("textarea.chapter-line-editor").element.value).toBe("第一行第二行");
    wrapper.unmount();
  });

  it("非章节文件保持原始 textarea 编辑模式", () => {
    const wrapper = mount(EditorPane, {
      props: {
        title: "架构",
        content: "架构内容",
        activeFile: {
          path: "architecture",
          name: "架构",
          kind: "file",
        },
      },
    });

    expect(wrapper.find("textarea.editor-textarea").exists()).toBe(true);
    expect(wrapper.find(".chapter-editor").exists()).toBe(false);
    wrapper.unmount();
  });

  it("预览态支持跨行框选并通过 Backspace 删除", async () => {
    const wrapper = mount(EditorPane, {
      props: {
        title: "章节",
        content: "第一行\n第二行\n第三行",
        activeFile: {
          path: "chapter:1",
          name: "第1章",
          kind: "chapter",
          chapterNumber: 1,
        },
      },
    });

    const previews = wrapper.findAll(".chapter-line-preview");
    const startNode = previews[0].find("span").element.firstChild as Node;
    const endNode = previews[1].find("span").element.firstChild as Node;
    const range = document.createRange();
    range.setStart(startNode, 0);
    range.setEnd(endNode, (endNode.nodeValue ?? "").length);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace" }));
    await nextTick();

    const emits = wrapper.emitted("update:content") ?? [];
    expect(emits.length).toBeGreaterThan(0);
    expect(emits[emits.length - 1]?.[0]).toBe("\n第三行");
    wrapper.unmount();
  });

  it("切换到同内容文件时应清理自动保存状态，避免误保存", async () => {
    vi.useFakeTimers();

    const wrapper = mount(EditorPane, {
      props: {
        title: "文件A",
        content: "文件A初始内容",
        activeFile: {
          path: "file-a",
          name: "文件A",
          kind: "file",
        },
      },
    });

    await wrapper.find("textarea.editor-textarea").setValue("共享内容");

    await wrapper.setProps({
      content: "共享内容",
      activeFile: {
        path: "file-b",
        name: "文件B",
        kind: "file",
      },
    });
    await nextTick();

    await vi.advanceTimersByTimeAsync(3100);

    expect(wrapper.emitted("save")).toBeUndefined();

    wrapper.unmount();
    vi.useRealTimers();
  });
});
