import { createRouter, createWebHistory } from "vue-router";
import { hasAccessKey } from "@/auth/accessKey";
import AuthView from "@/views/AuthView.vue";
import ProjectSelectView from "@/views/ProjectSelectView.vue";
import WorkbenchView from "@/views/WorkbenchView.vue";
import SettingsView from "@/views/SettingsView.vue";
import NotFoundView from "@/views/NotFoundView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/auth",
      name: "auth",
      component: AuthView,
    },
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

router.beforeEach((to) => {
  const authed = hasAccessKey();
  if (to.name === "auth") {
    if (!authed) {
      return true;
    }
    const redirect = typeof to.query.redirect === "string" ? to.query.redirect : "/";
    return redirect || "/";
  }
  if (authed) {
    return true;
  }
  return {
    name: "auth",
    query: {
      redirect: to.fullPath,
    },
  };
});

export default router;
