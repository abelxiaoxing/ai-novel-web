import { createRouter, createWebHistory } from "vue-router";
import ProjectSelectView from "@/views/ProjectSelectView.vue";
import WorkbenchView from "@/views/WorkbenchView.vue";
import SettingsView from "@/views/SettingsView.vue";
import NotFoundView from "@/views/NotFoundView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "projects",
      component: ProjectSelectView,
    },
    {
      path: "/projects/:id",
      name: "workbench",
      component: WorkbenchView,
      props: true,
    },
    {
      path: "/settings",
      name: "settings",
      component: SettingsView,
    },
    {
      path: "/:pathMatch(.*)*",
      name: "not-found",
      component: NotFoundView,
    },
  ],
  scrollBehavior() {
    return { top: 0 };
  },
});

export default router;
