const $ = (id) => document.getElementById(id);

const DEFAULTS = {
  apiBase: "",
  uploadToken: "",
  deviceId: "",
  captureOnlyVerify: false,
  pipelineMode: "full",
  aiBaseUrl: "https://api.openai.com/v1",
  aiApiKey: "",
  aiModel: "gpt-4o-mini",
  aiSystemPrompt:
    "你是助手。请用简洁中文总结网页正文要点，使用不超过 8 条短句或条目，总字数不超过 600 字。忽略导航、页脚、 Cookie 提示等噪音。",
};

function resolvePipelineModeForUi(cfg) {
  if (cfg.pipelineMode === "capture_preview" || cfg.pipelineMode === "ai_preview" || cfg.pipelineMode === "full") {
    return cfg.pipelineMode;
  }
  return cfg.captureOnlyVerify ? "capture_preview" : "full";
}

async function load() {
  const cfg = await chrome.storage.sync.get({ ...DEFAULTS, accessToken: "" });
  $("apiBase").value = cfg.apiBase;
  $("uploadToken").value = cfg.uploadToken || cfg.accessToken || "";
  $("deviceId").value = cfg.deviceId;
  $("pipelineMode").value = resolvePipelineModeForUi(cfg);
  $("aiBaseUrl").value = cfg.aiBaseUrl;
  $("aiApiKey").value = cfg.aiApiKey;
  $("aiModel").value = cfg.aiModel;
  $("aiSystemPrompt").value = cfg.aiSystemPrompt;
}

$("genDevice").addEventListener("click", () => {
  $("deviceId").value = crypto.randomUUID();
  $("status").textContent = "已生成 Device UUID（任意合法 UUID 均可）。";
});

$("save").addEventListener("click", async () => {
  const pipelineMode = $("pipelineMode").value || "full";
  await chrome.storage.sync.set({
    apiBase: $("apiBase").value.trim(),
    uploadToken: $("uploadToken").value.trim(),
    deviceId: $("deviceId").value.trim(),
    pipelineMode,
    captureOnlyVerify: pipelineMode === "capture_preview",
    aiBaseUrl: $("aiBaseUrl").value.trim() || DEFAULTS.aiBaseUrl,
    aiApiKey: $("aiApiKey").value.trim(),
    aiModel: $("aiModel").value.trim() || DEFAULTS.aiModel,
    aiSystemPrompt: $("aiSystemPrompt").value.trim() || DEFAULTS.aiSystemPrompt,
    accessToken: "",
  });
  $("status").textContent = "已保存。";
});

void load();

const link = $("shortcutLink");
if (link)
  link.addEventListener("click", (e) => {
    e.preventDefault();
    void chrome.tabs.create({ url: "chrome://extensions/shortcuts", active: true });
  });

