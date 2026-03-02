<template>
  <div class="auth-view">
    <section class="auth-card panel">
      <h1>访问认证</h1>
      <p class="muted">请输入访问密钥，认证通过后才能使用网站功能。</p>
      <form class="auth-form" @submit.prevent="submit">
        <label class="field">
          <span class="field-label">访问密钥</span>
          <input
            v-model="accessKeyInput"
            class="input-field"
            type="password"
            autocomplete="current-password"
            placeholder="请输入访问密钥"
            :disabled="submitting"
          />
        </label>
        <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>
        <button class="btn btn-primary" type="submit" :disabled="submitting">
          {{ submitting ? "认证中..." : "进入系统" }}
        </button>
      </form>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ApiError } from "@/api/client";
import { listProjects } from "@/api/projects";
import { clearAccessKey, setAccessKey } from "@/auth/accessKey";

const router = useRouter();
const route = useRoute();

const accessKeyInput = ref("");
const errorMessage = ref("");
const submitting = ref(false);

function resolveRedirectTarget() {
  const redirect = route.query.redirect;
  if (typeof redirect !== "string") {
    return "/";
  }
  if (!redirect.startsWith("/") || redirect.startsWith("//") || redirect.startsWith("/auth")) {
    return "/";
  }
  return redirect || "/";
}

async function submit() {
  const key = accessKeyInput.value.trim();
  if (!key) {
    errorMessage.value = "请输入访问密钥。";
    return;
  }
  errorMessage.value = "";
  submitting.value = true;
  setAccessKey(key);
  try {
    await listProjects();
    await router.replace(resolveRedirectTarget());
  } catch (error) {
    clearAccessKey();
    if (error instanceof ApiError && error.status === 401) {
      errorMessage.value = "密钥错误，请重试。";
    } else {
      errorMessage.value = "认证失败，请检查服务是否可用。";
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.auth-view {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  position: relative;
  z-index: 1;
}

.auth-card {
  width: min(460px, 100%);
  padding: 28px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--panel-border);
  background: linear-gradient(
    165deg,
    rgba(15, 26, 40, 0.92) 0%,
    rgba(12, 20, 32, 0.86) 100%
  );
  box-shadow: var(--shadow-soft);
}

h1 {
  margin: 0;
  font-size: 30px;
}

.auth-form {
  margin-top: 18px;
  display: grid;
  gap: 14px;
}

.field {
  display: grid;
  gap: 8px;
}

.field-label {
  font-weight: 600;
  color: var(--text-muted);
}

.input-field {
  width: 100%;
  border: 1px solid rgba(95, 170, 230, 0.28);
  background: rgba(7, 12, 19, 0.75);
  color: var(--text);
  border-radius: var(--radius-md);
  padding: 11px 12px;
  outline: none;
}

.input-field:focus {
  border-color: rgba(125, 211, 255, 0.6);
  box-shadow: 0 0 0 3px rgba(47, 155, 255, 0.18);
}

.btn {
  border: none;
  border-radius: var(--radius-md);
  padding: 11px 14px;
  font-size: 15px;
  cursor: pointer;
}

.btn-primary {
  background: linear-gradient(135deg, var(--accent), #2f6bff);
  color: #f2edff;
}

.btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.form-error {
  margin: 0;
  color: #fca5a5;
}

.muted {
  margin: 10px 0 0;
  color: var(--text-muted);
}
</style>
