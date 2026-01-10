import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import ProjectSelectView from "./ProjectSelectView.vue";
import { useProjectStore } from "@/stores/project";

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("ProjectSelectView Properties", () => {
  it("filters projects by search keyword", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const projectStore = useProjectStore();
    projectStore.fetchProjects = vi.fn().mockResolvedValue(undefined);

    const wrapper = mount(ProjectSelectView, {
      global: {
        plugins: [pinia],
        stubs: {
          ProjectCard: true,
          CreateProjectModal: true,
        },
      },
    });

    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 3, maxLength: 6 }),
        fc.string({ minLength: 1, maxLength: 5 }),
        async (names, keyword) => {
          projectStore.projects = names.map((name, index) => ({
            id: `p-${index}`,
            name,
          }));
          (wrapper.vm as any).searchQuery = keyword;
          const visible = (wrapper.vm as any).visibleProjects as { name: string }[];
          visible.forEach((project) => {
            expect(project.name.toLowerCase()).toContain(keyword.toLowerCase());
          });
        }
      ),
      { numRuns: 15 }
    );

    wrapper.unmount();
  });
});
