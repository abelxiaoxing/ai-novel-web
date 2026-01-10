import { defineStore } from "pinia";
import type { Project } from "@/api/types";
import {
  createProject,
  deleteProject,
  getChapter,
  getProject,
  getProjectFile,
  listChapters,
  listProjectFiles,
  listProjects,
  deleteChapter,
  renameChapter,
  updateChapter,
  updateProjectFile,
} from "@/api/projects";

export type FileNode = {
  id: string;
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileNode[];
  chapterNumber?: number;
};

export type ActiveFile = {
  path: string;
  name: string;
  kind: "file" | "chapter";
  chapterNumber?: number;
};

const BASE_FILES = [
  "architecture",
  "directory",
  "summary",
  "character_state",
  "plot_arcs",
];

function normalizeContent(payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }
  if (
    payload &&
    typeof payload === "object" &&
    "content" in payload &&
    typeof (payload as { content: string }).content === "string"
  ) {
    return (payload as { content: string }).content;
  }
  return "";
}

function buildTreeFromPaths(paths: string[]): FileNode[] {
  const root: FileNode[] = [];
  const addNode = (parts: string[], fullPath: string) => {
    let currentLevel = root;
    parts.forEach((part, index) => {
      const existing = currentLevel.find((node) => node.name === part);
      if (existing) {
        currentLevel = existing.children ?? [];
        return;
      }
      const isLeaf = index === parts.length - 1;
      const node: FileNode = {
        id: parts.slice(0, index + 1).join("/"),
        name: part,
        path: isLeaf ? fullPath : parts.slice(0, index + 1).join("/"),
        type: isLeaf ? "file" : "folder",
        children: isLeaf ? undefined : [],
      };
      currentLevel.push(node);
      currentLevel = node.children ?? [];
    });
  };

  paths.forEach((path) => {
    const cleaned = path.replace(/^\//, "");
    const parts = cleaned.split("/").filter(Boolean);
    if (!parts.length) {
      return;
    }
    addNode(parts, cleaned);
  });

  return root;
}

function buildChapterNodes(chapters: number[]): FileNode {
  return {
    id: "chapters",
    name: "chapters",
    path: "chapters",
    type: "folder",
    children: chapters.map((number) => ({
      id: `chapter-${number}`,
      name: `chapter_${number}.txt`,
      path: `chapter:${number}`,
      type: "file",
      chapterNumber: number,
    })),
  };
}

export const useProjectStore = defineStore("project", {
  state: () => ({
    projects: [] as Project[],
    currentProject: null as Project | null,
    fileTree: [] as FileNode[],
    activeFile: null as ActiveFile | null,
    editorContent: "",
    loading: false,
    error: null as string | null,
  }),
  actions: {
    async fetchProjects() {
      this.loading = true;
      this.error = null;
      try {
        this.projects = await listProjects();
      } catch (error) {
        this.error = error instanceof Error ? error.message : "加载项目列表失败";
      } finally {
        this.loading = false;
      }
    },
    async createProject(payload: Partial<Project>) {
      this.loading = true;
      this.error = null;
      try {
        const project = await createProject(payload);
        this.projects = [project, ...this.projects.filter((item) => item.id !== project.id)];
        return project;
      } catch (error) {
        this.error = error instanceof Error ? error.message : "创建项目失败";
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async deleteProject(projectId: string) {
      this.loading = true;
      this.error = null;
      try {
        await deleteProject(projectId);
        this.projects = this.projects.filter((project) => project.id !== projectId);
        if (this.currentProject?.id === projectId) {
          this.currentProject = null;
          this.resetActiveFile();
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : "删除项目失败";
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async loadProject(projectId: string) {
      this.loading = true;
      this.error = null;
      try {
        this.resetActiveFile();
        this.currentProject = await getProject(projectId);
        await this.refreshFileTree(projectId);
      } catch (error) {
        this.error = error instanceof Error ? error.message : "加载项目失败";
      } finally {
        this.loading = false;
      }
    },
    async refreshFileTree(projectId?: string) {
      const id = projectId ?? this.currentProject?.id;
      if (!id) {
        return;
      }
      try {
        const [filesPayload, chaptersPayload] = await Promise.all([
          listProjectFiles(id),
          listChapters(id),
        ]);

        let tree: FileNode[] = [];
        if (
          !Array.isArray(filesPayload) &&
          filesPayload.entries &&
          filesPayload.entries.length > 0
        ) {
          tree = filesPayload.entries.map((entry) => ({
            ...entry,
            id: entry.path,
            type: entry.type ?? "file",
          }));
        } else {
          const fileList = Array.isArray(filesPayload)
            ? filesPayload
            : filesPayload.files ?? [];
          if (fileList.length > 0) {
            tree = buildTreeFromPaths(fileList);
          } else {
            tree = buildTreeFromPaths(BASE_FILES);
          }
        }

        const chaptersRaw = Array.isArray(chaptersPayload)
          ? chaptersPayload
          : chaptersPayload.chapters ?? [];
        const chapters = chaptersRaw
          .map((value) => Number(value))
          .filter((value) => !Number.isNaN(value));
        if (chapters.length) {
          tree.push(buildChapterNodes(chapters));
        }

        this.fileTree = tree;
      } catch (error) {
        this.error = error instanceof Error ? error.message : "加载项目文件失败";
      }
    },
    async openFile(node: ActiveFile) {
      const projectId = this.currentProject?.id;
      if (!projectId) {
        return;
      }
      this.loading = true;
      this.error = null;
      try {
        if (node.kind === "chapter" && node.chapterNumber) {
          const payload = await getChapter(projectId, node.chapterNumber);
          this.editorContent = normalizeContent(payload);
        } else {
          const payload = await getProjectFile(projectId, node.path);
          this.editorContent = normalizeContent(payload);
        }
        this.activeFile = node;
      } catch (error) {
        this.error = error instanceof Error ? error.message : "打开文件失败";
      } finally {
        this.loading = false;
      }
    },
    async saveActiveFile() {
      const projectId = this.currentProject?.id;
      if (!projectId || !this.activeFile) {
        return;
      }
      this.loading = true;
      this.error = null;
      try {
        if (this.activeFile.kind === "chapter" && this.activeFile.chapterNumber) {
          await updateChapter(projectId, this.activeFile.chapterNumber, this.editorContent);
        } else {
          await updateProjectFile(projectId, this.activeFile.path, this.editorContent);
        }
      } catch (error) {
        this.error = error instanceof Error ? error.message : "保存文件失败";
      } finally {
        this.loading = false;
      }
    },
    async deleteChapterFile(chapterNumber: number) {
      const projectId = this.currentProject?.id;
      if (!projectId) {
        return;
      }
      this.loading = true;
      this.error = null;
      try {
        await deleteChapter(projectId, chapterNumber);
        if (this.activeFile?.chapterNumber === chapterNumber) {
          this.resetActiveFile();
        }
        await this.refreshFileTree(projectId);
      } catch (error) {
        this.error = error instanceof Error ? error.message : "删除章节失败";
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async renameChapterFile(chapterNumber: number, newNumber: number) {
      const projectId = this.currentProject?.id;
      if (!projectId) {
        return;
      }
      this.loading = true;
      this.error = null;
      try {
        await renameChapter(projectId, chapterNumber, newNumber);
        await this.refreshFileTree(projectId);
      } catch (error) {
        this.error = error instanceof Error ? error.message : "重命名章节失败";
        throw error;
      } finally {
        this.loading = false;
      }
    },
    setEditorContent(value: string) {
      this.editorContent = value;
    },
    resetActiveFile() {
      this.activeFile = null;
      this.editorContent = "";
    },
  },
});
