<template>
  <div class="settings-view fade-in">
    <header class="settings-header">
      <h1>设置中心</h1>
      <p class="muted">管理模型配置、默认选择与系统偏好。</p>
    </header>
    <section class="settings-grid">
      <div class="panel section-card">
        <h3>默认配置</h3>
        <p class="muted">设置各任务使用的默认模型。</p>
        <button class="btn btn-ghost" @click="openChooseManager">配置默认</button>
      </div>
      <div class="panel section-card">
        <h3>大模型配置</h3>
        <p class="muted">管理提示词、架构与定稿所用模型。</p>
        <button class="btn btn-ghost" @click="openConfigManager('llm')">打开管理器</button>
      </div>
      <div class="panel section-card">
        <h3>向量配置</h3>
        <p class="muted">设置检索参数与向量库行为。</p>
        <button class="btn btn-ghost" @click="openConfigManager('embedding')">打开管理器</button>
      </div>
      <div class="panel section-card">
        <h3>代理与同步</h3>
        <p class="muted">配置网络代理与备份集成。</p>
        <button class="btn btn-ghost" @click="openProxyManager">配置</button>
      </div>
    </section>
    <button class="btn btn-outline" @click="$router.push('/')">返回项目列表</button>

    <ModalShell
      v-if="chooseModalOpen"
      panel-class="settings-modal settings-modal--choose"
      @close="chooseModalOpen = false"
    >
      <div class="modal-header">
        <h2>默认配置选择</h2>
        <p class="muted">为各任务指定默认使用的模型配置。</p>
      </div>
      <div class="modal-body choose-modal-body">
        <div class="choose-grid">
          <label class="field">
            <span class="field-label">架构生成</span>
            <select class="select-field" v-model="chooseForm.architecture_llm">
              <option value="">自动选择</option>
              <option v-for="name in configStore.llmConfigs" :key="name" :value="name">{{ name }}</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">章节蓝图</span>
            <select class="select-field" v-model="chooseForm.chapter_outline_llm">
              <option value="">自动选择</option>
              <option v-for="name in configStore.llmConfigs" :key="name" :value="name">{{ name }}</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">提示词/草稿</span>
            <select class="select-field" v-model="chooseForm.prompt_draft_llm">
              <option value="">自动选择</option>
              <option v-for="name in configStore.llmConfigs" :key="name" :value="name">{{ name }}</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">章节定稿</span>
            <select class="select-field" v-model="chooseForm.finalize_llm">
              <option value="">自动选择</option>
              <option v-for="name in configStore.llmConfigs" :key="name" :value="name">{{ name }}</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">一致性检查</span>
            <select class="select-field" v-model="chooseForm.consistency_llm">
              <option value="">自动选择</option>
              <option v-for="name in configStore.llmConfigs" :key="name" :value="name">{{ name }}</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">向量模型</span>
            <select class="select-field" v-model="chooseForm.embedding">
              <option value="">自动选择</option>
              <option v-for="name in configStore.embeddingConfigs" :key="name" :value="name">{{ name }}</option>
            </select>
          </label>
        </div>
        <p v-if="chooseError" class="form-error">{{ chooseError }}</p>
        <p v-if="chooseSaving" class="form-muted">保存中...</p>
        <div class="action-row">
          <button class="btn btn-outline" @click="chooseModalOpen = false">关闭</button>
        </div>
      </div>
    </ModalShell>

    <ModalShell
      v-if="configModalOpen"
      panel-class="settings-modal settings-modal--config"
      @close="configModalOpen = false"
    >
      <div class="modal-header">
        <h2>{{ configModalTitle }}</h2>
        <p class="muted">编辑后保存会直接更新本地配置文件。</p>
      </div>
      <div class="modal-body config-modal-body">
        <div class="field-row config-meta-row">
          <label class="field">
            <span class="field-label">选择配置</span>
            <select class="select-field" :value="selectedConfigName" @change="handleConfigSelect">
              <option v-if="!configNames.length" value="">暂无配置</option>
              <option v-for="name in configNames" :key="name" :value="name">{{ name }}</option>
            </select>
          </label>
          <label class="field">
            <span class="field-label">新配置名称</span>
            <input class="input-field" v-model="newConfigName" placeholder="输入新名称" />
          </label>
        </div>
        <label class="field">
          <span class="field-label">配置内容（JSON）</span>
          <textarea class="textarea-field code-field" rows="9" v-model="configJson"></textarea>
        </label>
        <p v-if="configError" class="form-error">{{ configError }}</p>
        <p v-if="configTestMessage" :class="configTestClass">{{ configTestMessage }}</p>
        <p v-if="configSaving" class="form-muted">保存中...</p>
        <div class="action-row">
          <button class="btn btn-outline" @click="testConfig" :disabled="configSaving || configTesting">
            测试模型
          </button>
          <button class="btn btn-ghost" @click="createConfig" :disabled="configSaving">
            新建配置
          </button>
          <button class="btn btn-outline" @click="deleteConfig" :disabled="configSaving || !selectedConfigName">
            删除
          </button>
          <button class="btn btn-outline" @click="configModalOpen = false">关闭</button>
        </div>
      </div>
    </ModalShell>

    <ModalShell
      v-if="proxyModalOpen"
      panel-class="settings-modal settings-modal--proxy"
      @close="proxyModalOpen = false"
    >
      <div class="modal-header">
        <h2>代理与同步配置</h2>
        <p class="muted">代理将影响接口请求，WebDAV 用于备份设置。</p>
      </div>
      <div class="modal-body proxy-modal-body">
        <div class="proxy-grid">
          <div class="section-inline">
            <h3>代理设置</h3>
            <label class="field">
              <span class="field-label">代理地址</span>
              <input class="input-field" v-model="proxyForm.proxy_url" placeholder="127.0.0.1" />
            </label>
            <label class="field">
              <span class="field-label">代理端口</span>
              <input class="input-field" v-model="proxyForm.proxy_port" placeholder="7890" />
            </label>
            <label class="checkbox-row">
              <input type="checkbox" v-model="proxyForm.enabled" />
              <span>启用代理</span>
            </label>
          </div>
          <div class="section-inline">
            <h3>WebDAV 同步</h3>
            <label class="field">
              <span class="field-label">WebDAV 地址</span>
              <input class="input-field" v-model="proxyForm.webdav_url" placeholder="https://dav.example.com" />
            </label>
            <label class="field">
              <span class="field-label">账号</span>
              <input class="input-field" v-model="proxyForm.webdav_username" />
            </label>
            <label class="field">
              <span class="field-label">密码</span>
              <input class="input-field" type="password" v-model="proxyForm.webdav_password" />
            </label>
          </div>
        </div>
        <p v-if="proxyError" class="form-error">{{ proxyError }}</p>
        <p v-if="proxySaving" class="form-muted">保存中...</p>
        <div class="action-row">
          <button class="btn btn-outline" @click="proxyModalOpen = false">关闭</button>
        </div>
      </div>
    </ModalShell>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import ModalShell from "@/components/ModalShell.vue";
import { useConfigStore } from "@/stores/config";
import {
  createEmbeddingConfig,
  createLlmConfig,
  deleteEmbeddingConfig,
  deleteLlmConfig,
  getEmbeddingConfigs,
  getLlmConfigs,
  getProxyConfig,
  getWebdavConfig,
  testEmbeddingConfig,
  testLlmConfig,
  updateChooseConfigs,
  updateEmbeddingConfig,
  updateLlmConfig,
  updateProxyConfig,
  updateWebdavConfig,
} from "@/api/config";

type ConfigType = "llm" | "embedding";

const configStore = useConfigStore();
const configModalOpen = ref(false);
const proxyModalOpen = ref(false);
const chooseModalOpen = ref(false);
const activeConfigType = ref<ConfigType>("llm");
const configNames = ref<string[]>([]);
const configMap = ref<Record<string, unknown>>({});
const selectedConfigName = ref("");
const configJson = ref("");
const configJsonBaseline = ref("");
const newConfigName = ref("");
const configError = ref("");
const configTestMessage = ref("");
const configTestStatus = ref<"success" | "failed" | "pending" | "">("");
const configSaving = ref(false);
const configTesting = ref(false);
let configSaveTimer: ReturnType<typeof setTimeout> | null = null;

const chooseForm = reactive({
  architecture_llm: "",
  chapter_outline_llm: "",
  prompt_draft_llm: "",
  finalize_llm: "",
  consistency_llm: "",
  embedding: "",
});
const chooseError = ref("");
const chooseSaving = ref(false);
const chooseHydrating = ref(false);
let chooseSaveTimer: ReturnType<typeof setTimeout> | null = null;

// 自动保存模型选择配置
watch(
  chooseForm,
  () => {
    if (chooseSaveTimer) {
      clearTimeout(chooseSaveTimer);
    }
    if (chooseHydrating.value || !chooseModalOpen.value) {
      return;
    }
    chooseError.value = "";
    chooseSaveTimer = setTimeout(async () => {
      try {
        chooseSaving.value = true;
        await updateChooseConfigs({ ...chooseForm });
        await configStore.fetchConfigs();
      } catch (error) {
        chooseError.value = error instanceof Error ? error.message : "自动保存失败";
      } finally {
        chooseSaving.value = false;
      }
    }, 800);
  },
  { deep: true }
);

const proxyForm = reactive({
  proxy_url: "",
  proxy_port: "",
  enabled: false,
  webdav_url: "",
  webdav_username: "",
  webdav_password: "",
});
const proxyError = ref("");
const proxySaving = ref(false);
const proxyHydrating = ref(false);
let proxySaveTimer: ReturnType<typeof setTimeout> | null = null;

// 自动保存代理设置
watch(
  proxyForm,
  () => {
    if (proxySaveTimer) {
      clearTimeout(proxySaveTimer);
    }
    if (proxyHydrating.value || !proxyModalOpen.value) {
      return;
    }
    proxyError.value = "";
    proxySaveTimer = setTimeout(async () => {
      try {
        proxySaving.value = true;
        await Promise.all([
          updateProxyConfig({
            proxy_url: proxyForm.proxy_url,
            proxy_port: proxyForm.proxy_port,
            enabled: proxyForm.enabled,
          }),
          updateWebdavConfig({
            webdav_url: proxyForm.webdav_url,
            webdav_username: proxyForm.webdav_username,
            webdav_password: proxyForm.webdav_password,
          }),
        ]);
      } catch (error) {
        proxyError.value = error instanceof Error ? error.message : "保存代理配置失败";
      } finally {
        proxySaving.value = false;
      }
    }, 800);
  },
  { deep: true }
);

const configModalTitle = computed(() =>
  activeConfigType.value === "llm" ? "大模型配置管理" : "向量配置管理"
);

const configTestClass = computed(() => {
  if (configTestStatus.value === "success") {
    return "form-success";
  }
  if (configTestStatus.value === "failed") {
    return "form-error";
  }
  return "form-muted";
});

const normalizeConfigMap = (payload: Record<string, unknown> | undefined) => {
  if (!payload) {
    return {};
  }
  if ("configs" in payload && typeof payload.configs === "object") {
    return payload.configs as Record<string, unknown>;
  }
  return payload;
};

const setConfigJson = (value: string) => {
  configJson.value = value;
  configJsonBaseline.value = value;
};

const refreshConfigNames = () => {
  configNames.value = Object.keys(configMap.value);
  if (!configNames.value.length) {
    selectedConfigName.value = "";
    setConfigJson("{}");
    configTestMessage.value = "";
    configTestStatus.value = "";
    return;
  }
  if (!selectedConfigName.value || !(selectedConfigName.value in configMap.value)) {
    selectedConfigName.value = configNames.value[0];
  }
  const entry = configMap.value[selectedConfigName.value] ?? {};
  setConfigJson(JSON.stringify(entry, null, 2));
  configTestMessage.value = "";
  configTestStatus.value = "";
};

const loadConfigs = async () => {
  configError.value = "";
  try {
    const payload =
      activeConfigType.value === "llm" ? await getLlmConfigs() : await getEmbeddingConfigs();
    configMap.value = normalizeConfigMap(payload as Record<string, unknown>);
    refreshConfigNames();
  } catch (error) {
    configError.value = error instanceof Error ? error.message : "加载配置失败";
  }
};

const openConfigManager = async (type: ConfigType) => {
  activeConfigType.value = type;
  configModalOpen.value = true;
  configTestMessage.value = "";
  configTestStatus.value = "";
  await loadConfigs();
};

const openChooseManager = () => {
  chooseHydrating.value = true;
  chooseError.value = "";
  const choose = configStore.chooseConfigs;
  chooseForm.architecture_llm = choose.architecture_llm ?? "";
  chooseForm.chapter_outline_llm = choose.chapter_outline_llm ?? "";
  chooseForm.prompt_draft_llm = choose.prompt_draft_llm ?? "";
  chooseForm.finalize_llm = choose.finalize_llm ?? "";
  chooseForm.consistency_llm = choose.consistency_llm ?? "";
  chooseForm.embedding = choose.embedding ?? "";
  chooseModalOpen.value = true;
  nextTick(() => {
    chooseHydrating.value = false;
  });
};

const saveChooseConfigs = async () => {
  chooseSaving.value = true;
  chooseError.value = "";
  try {
    await updateChooseConfigs({ ...chooseForm });
    await configStore.fetchConfigs();
    chooseModalOpen.value = false;
  } catch (error) {
    chooseError.value = error instanceof Error ? error.message : "保存失败";
  } finally {
    chooseSaving.value = false;
  }
};

const handleConfigSelect = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  selectedConfigName.value = target.value;
  const entry = configMap.value[selectedConfigName.value] ?? {};
  setConfigJson(JSON.stringify(entry, null, 2));
  configTestMessage.value = "";
  configTestStatus.value = "";
};

const parseConfigJson = () => {
  configError.value = "";
  configTestMessage.value = "";
  configTestStatus.value = "";
  try {
    return JSON.parse(configJson.value || "{}") as Record<string, unknown>;
  } catch (error) {
    configError.value = "配置 JSON 无法解析，请检查格式。";
    return null;
  }
};

// 自动保存配置编辑器
watch(configJson, () => {
  if (configSaveTimer) {
    clearTimeout(configSaveTimer);
  }
  if (!configModalOpen.value || configJson.value === configJsonBaseline.value) {
    return;
  }
  if (!selectedConfigName.value) {
    return;
  }
  configSaveTimer = setTimeout(async () => {
    const payload = parseConfigJson();
    if (!payload) {
      return;
    }
    configSaving.value = true;
    try {
      if (activeConfigType.value === "llm") {
        await updateLlmConfig(selectedConfigName.value, payload);
      } else {
        await updateEmbeddingConfig(selectedConfigName.value, payload);
      }
      await loadConfigs();
      await configStore.fetchConfigs();
    } catch (error) {
      configError.value = error instanceof Error ? error.message : "保存配置失败";
    } finally {
      configSaving.value = false;
    }
  }, 1000);
});

const testConfig = async () => {
  const payload = parseConfigJson();
  if (!payload) {
    return;
  }
  configTesting.value = true;
  configTestMessage.value = "测试中...";
  configTestStatus.value = "pending";
  try {
    const result =
      activeConfigType.value === "llm"
        ? await testLlmConfig(payload)
        : await testEmbeddingConfig(payload);
    if (result.ok) {
      configTestStatus.value = "success";
      configTestMessage.value = result.sample
        ? `测试成功：${result.sample}`
        : result.message || "测试成功。";
    } else {
      configTestStatus.value = "failed";
      configTestMessage.value = result.message || "测试失败。";
    }
  } catch (error) {
    configTestStatus.value = "failed";
    configTestMessage.value = error instanceof Error ? error.message : "测试失败。";
  } finally {
    configTesting.value = false;
  }
};

const saveConfig = async () => {
  if (!selectedConfigName.value) {
    configError.value = "请先选择要保存的配置。";
    return;
  }
  const payload = parseConfigJson();
  if (!payload) {
    return;
  }
  configSaving.value = true;
  try {
    if (activeConfigType.value === "llm") {
      await updateLlmConfig(selectedConfigName.value, payload);
    } else {
      await updateEmbeddingConfig(selectedConfigName.value, payload);
    }
    await loadConfigs();
    await configStore.fetchConfigs();
  } catch (error) {
    configError.value = error instanceof Error ? error.message : "保存配置失败";
  } finally {
    configSaving.value = false;
  }
};

const createConfig = async () => {
  const name = newConfigName.value.trim();
  if (!name) {
    configError.value = "请输入新配置名称。";
    return;
  }
  const payload = parseConfigJson();
  if (!payload) {
    return;
  }
  configSaving.value = true;
  try {
    if (activeConfigType.value === "llm") {
      await createLlmConfig(name, payload);
    } else {
      await createEmbeddingConfig(name, payload);
    }
    newConfigName.value = "";
    configTestMessage.value = "";
    configTestStatus.value = "";
    await loadConfigs();
    selectedConfigName.value = name;
    await configStore.fetchConfigs();
  } catch (error) {
    configError.value = error instanceof Error ? error.message : "新建配置失败";
  } finally {
    configSaving.value = false;
  }
};

const deleteConfig = async () => {
  if (!selectedConfigName.value) {
    return;
  }
  const ok = window.confirm(`确认删除配置「${selectedConfigName.value}」？`);
  if (!ok) {
    return;
  }
  configSaving.value = true;
  try {
    if (activeConfigType.value === "llm") {
      await deleteLlmConfig(selectedConfigName.value);
    } else {
      await deleteEmbeddingConfig(selectedConfigName.value);
    }
    selectedConfigName.value = "";
    await loadConfigs();
    await configStore.fetchConfigs();
  } catch (error) {
    configError.value = error instanceof Error ? error.message : "删除配置失败";
  } finally {
    configSaving.value = false;
  }
};

const openProxyManager = async () => {
  proxyHydrating.value = true;
  proxyModalOpen.value = true;
  proxyError.value = "";
  try {
    const [proxyPayload, webdavPayload] = await Promise.all([
      getProxyConfig(),
      getWebdavConfig(),
    ]);
    proxyForm.proxy_url = String(proxyPayload.proxy_url ?? "");
    proxyForm.proxy_port = String(proxyPayload.proxy_port ?? "");
    proxyForm.enabled = Boolean(proxyPayload.enabled);
    proxyForm.webdav_url = String(webdavPayload.webdav_url ?? "");
    proxyForm.webdav_username = String(webdavPayload.webdav_username ?? "");
    proxyForm.webdav_password = String(webdavPayload.webdav_password ?? "");
  } catch (error) {
    proxyError.value = error instanceof Error ? error.message : "加载代理配置失败";
  } finally {
    nextTick(() => {
      proxyHydrating.value = false;
    });
  }
};

const saveProxySettings = async () => {
  proxySaving.value = true;
  proxyError.value = "";
  try {
    await Promise.all([
      updateProxyConfig({
        proxy_url: proxyForm.proxy_url,
        proxy_port: proxyForm.proxy_port,
        enabled: proxyForm.enabled,
      }),
      updateWebdavConfig({
        webdav_url: proxyForm.webdav_url,
        webdav_username: proxyForm.webdav_username,
        webdav_password: proxyForm.webdav_password,
      }),
    ]);
    proxyModalOpen.value = false;
  } catch (error) {
    proxyError.value = error instanceof Error ? error.message : "保存代理配置失败";
  } finally {
    proxySaving.value = false;
  }
};

onMounted(() => {
  configStore.fetchConfigs();
});
</script>

<style scoped>
.settings-view {
  padding: 48px clamp(24px, 6vw, 80px);
  display: flex;
  flex-direction: column;
  gap: 32px;
  position: relative;
  z-index: 1;
}

.settings-header {
  animation: fadeInUp 0.5s ease forwards;
}

.settings-header h1 {
  margin: 0 0 8px 0;
  font-size: clamp(28px, 4vw, 40px);
  font-weight: 800;
  background: linear-gradient(135deg, var(--text) 0%, var(--accent-bright) 50%, var(--accent) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}

.section-card {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: linear-gradient(135deg, rgba(15, 26, 40, 0.95), rgba(10, 18, 28, 0.98));
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-soft), var(--glow-soft);
  transition: all 0.3s ease;
  animation: fadeInUp 0.5s ease forwards;
  animation-delay: calc(var(--i, 0) * 0.1s);
  opacity: 0;
}

.section-card:nth-child(1) { --i: 1; }
.section-card:nth-child(2) { --i: 2; }
.section-card:nth-child(3) { --i: 3; }
.section-card:nth-child(4) { --i: 4; }

.section-card:hover {
  transform: translateY(-4px);
  border-color: rgba(95, 170, 230, 0.5);
  box-shadow: var(--shadow-soft), 0 0 40px rgba(47, 155, 255, 0.2);
}

.section-card h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--accent-bright);
}

.modal-header h2 {
  margin: 0 0 4px 0;
  color: var(--accent-bright);
  font-size: 20px;
  font-weight: 700;
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

:deep(.modal-panel.settings-modal) {
  padding: clamp(20px, 2.8vh, 28px);
}

:deep(.modal-panel.settings-modal--choose),
:deep(.modal-panel.settings-modal--proxy) {
  width: min(760px, 100%);
}

:deep(.modal-panel.settings-modal--config) {
  width: min(920px, 100%);
}

.choose-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.config-meta-row {
  align-items: flex-end;
}

.config-modal-body {
  gap: 14px;
}

/* 表单字段样式 */
.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.field-row .field {
  flex: 1;
  min-width: 140px;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.02em;
}

.code-field {
  font-family: var(--font-mono);
  background: rgba(8, 14, 22, 0.9);
  border: 1px solid rgba(95, 170, 230, 0.2);
  color: #d4e3f5;
  line-height: 1.5;
  resize: vertical;
  min-height: 200px;
}

.code-field:focus {
  border-color: rgba(125, 211, 255, 0.5);
  box-shadow: 0 0 0 3px rgba(47, 155, 255, 0.1);
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 8px;
  padding-top: 16px;
  border-top: 1px solid rgba(95, 170, 230, 0.15);
}

.form-error {
  color: var(--danger);
  font-size: 13px;
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(239, 68, 68, 0.25);
}

.form-success {
  color: var(--success);
  font-size: 13px;
  padding: 8px 12px;
  background: rgba(34, 197, 94, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(34, 197, 94, 0.25);
}

.form-muted {
  color: var(--text-muted);
  font-size: 13px;
  padding: 8px 12px;
  background: rgba(139, 163, 199, 0.08);
  border-radius: 8px;
}

.section-inline {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 0;
  border-bottom: 1px solid rgba(95, 170, 230, 0.15);
}

.section-inline:last-child {
  border-bottom: none;
}

.proxy-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.proxy-grid .section-inline,
.proxy-grid .section-inline:last-child {
  border-bottom: none;
  border: 1px solid rgba(95, 170, 230, 0.18);
  border-radius: 12px;
  padding: 14px;
  background: rgba(9, 16, 26, 0.4);
}

.section-inline h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-inline h3::before {
  content: "";
  width: 3px;
  height: 16px;
  background: linear-gradient(180deg, var(--accent-bright), var(--accent));
  border-radius: 2px;
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-muted);
  font-size: 14px;
  padding: 8px 0;
  cursor: pointer;
  user-select: none;
  transition: color 0.2s ease;
}

.checkbox-row:hover {
  color: var(--text);
}

.checkbox-row input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--accent);
  cursor: pointer;
}

@media (max-width: 900px) {
  :deep(.modal-panel.settings-modal--config) {
    width: min(760px, 100%);
  }

  .proxy-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .choose-grid {
    grid-template-columns: 1fr;
  }

  .config-meta-row {
    align-items: stretch;
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
