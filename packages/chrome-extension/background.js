/**
 * MV3：快捷键（默认 Ctrl+Q）抓取当前标签页 → 可选仅预览正文 / AI 预览 / AI+上传
 */

const STORAGE_LAST_CAPTURE = "tmLastPageCapture";
const STORAGE_LAST_AI = "tmLastAiPreview";
/** 单条正文最大存入长度（chrome.storage.local 有配额） */
const MAX_STORED_TEXT = 800_000;
/** 非流式 chat/completions 等待上限（秒）；超时你会看到明确错误，而不是一直无反馈 */
const AI_FETCH_TIMEOUT_MS = 120_000;

function truncate(str, max) {
  if (!str || str.length <= max) return str || "";
  return str.slice(0, max) + "\n…（已截断）";
}

function resolvePipelineMode(cfg) {
  const p = cfg.pipelineMode;
  if (p === "capture_preview" || p === "ai_preview" || p === "full") return p;
  return cfg.captureOnlyVerify ? "capture_preview" : "full";
}

async function loadConfig() {
  return chrome.storage.sync.get({
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
  });
}

function logPageCapture(result) {
  const text = result?.text ?? "";
  const previewLen = 3000;
  const head = text.slice(0, previewLen);
  console.log("%c[TimeManager 页面监听] 抓取结果", "font-weight:bold;color:#4f46e5");
  console.log("title:", result?.title ?? "");
  console.log("url:", result?.url ?? "");
  console.log("正文字符数:", text.length);
  console.log(
    `正文预览（前 ${Math.min(previewLen, text.length)} / ${text.length} 字）:`,
    "\n" + head + (text.length > previewLen ? "\n…（余下已省略，完整内容见正文字符数）" : "")
  );
}

function normalizeApiBase(raw) {
  let b = String(raw || "").trim().replace(/\/+$/, "");
  if (!b) return "";
  if (!/^https?:\/\//i.test(b)) b = `http://${b}`;
  return b;
}

/**
 * 若你已把地址填到 …/chat/completions，不再重复拼接（否则会出现 …/chat/completions/chat/completions 导致 404）。
 * 推荐写法：OpenAI 填 https://api.openai.com/v1 ；字节/方舟等常见填 …/api/v3 即可。
 */
function resolveChatCompletionsUrl(raw) {
  const base = normalizeApiBase(raw);
  if (!base) return "";
  if (/\/chat\/completions$/i.test(base)) return base;
  return `${base}/chat/completions`;
}

/**
 * SW 里没有「当前窗口」：用 lastFocusedWindow 才通常是用户正在看的前台窗口。
 */
async function getLikelyActiveTab() {
  let tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  let tab = tabs[0];
  if (!tab?.id) {
    tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    tab = tabs[0];
  }
  if (!tab?.id) {
    const active = await chrome.tabs.query({ active: true });
    tab = active.find((t) => typeof t.url === "string");
  }
  return tab;
}

async function setBadgeBusy() {
  try {
    await chrome.action.setBadgeBackgroundColor({ color: "#4338ca" });
    await chrome.action.setBadgeText({ text: "…" });
  } catch {
    /* ignore */
  }
}

async function setBadgeDone() {
  try {
    await chrome.action.setBadgeText({ text: "" });
  } catch {
    /* ignore */
  }
}

/** @returns {{ summary: string, debugRawSnippet: string }} */
async function summarizePage({ title, url, text }, cfg) {
  const aiUrl = resolveChatCompletionsUrl(cfg.aiBaseUrl);
  const key = String(cfg.aiApiKey || "").trim();
  if (!aiUrl || !key) {
    throw new Error("请在扩展选项中填写 AI API 地址与 API Key");
  }
  const snippet = truncate(text, 120_000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_FETCH_TIMEOUT_MS);

  let res;
  try {
    console.log("[TimeManager] POST", aiUrl);
    res = await fetch(aiUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: String(cfg.aiModel || "gpt-4o-mini").trim(),
        messages: [
          { role: "system", content: String(cfg.aiSystemPrompt || "") },
          {
            role: "user",
            content: `页面标题：${title}\nURL：${url}\n正文：\n${snippet}`,
          },
        ],
      }),
    });
  } catch (err) {
    if (err && typeof err === "object" && err.name === "AbortError") {
      throw new Error(
        `AI 请求在 ${AI_FETCH_TIMEOUT_MS / 1000}s 内无响应已中止。常见于网络不通、代理、或接口卡住。这与「是否流式」无关：扩展使用的是普通 JSON 而非 stream。`,
      );
    }
    throw new Error(`AI 网络错误：${err instanceof Error ? err.message : String(err)}`);
  } finally {
    clearTimeout(timer);
  }

  const rawText = await res.text();
  const debugRawSnippet = rawText.slice(0, 20_000);
  if (!res.ok) {
    throw new Error(`AI 请求失败 ${res.status}: ${rawText.slice(0, 300)}`);
  }
  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error("AI 返回不是合法 JSON");
  }
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("AI 未返回有效正文");
  }
  return {
    summary: content.trim(),
    debugRawSnippet,
  };
}

async function submitCapture(cfg, body) {
  const apiBase = normalizeApiBase(cfg.apiBase);
  const token = String(cfg.uploadToken || "").trim();
  const deviceId = String(cfg.deviceId || "").trim();
  if (!apiBase) throw new Error("请在扩展选项填写服务端 API 地址");
  if (!token) throw new Error("请在扩展选项填写「扩展上传密钥」（手机 App → 监听页面 → 扩展密钥）");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceId)) {
    throw new Error("请在扩展选项填写合法的 X-Device-Id（UUID）");
  }
  const res = await fetch(`${apiBase}/api/v1/page-listen/captures`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Device-Id": deviceId,
    },
    body: JSON.stringify(body),
  });
  const t = await res.text();
  if (!res.ok) {
    throw new Error(`上传失败 ${res.status}: ${t.slice(0, 400)}`);
  }
}

/**
 * @param {chrome.tabs.Tab | undefined} tab
 */
async function runPipelineForTab(tab) {
  const explainInvalid =
    !tab?.id || !tab.url || !/^https?:\/\//i.test(tab.url || "")
      ? "请切换到普通网页标签（地址栏以 http 或 https 开头），不要使用 chrome://、「新标签页」空白、扩展商店页或 PDF 阅读器等无法注入脚本的页面。若快捷键无反应也可能是未绑定快捷键：chrome://extensions/shortcuts。"
      : null;
  if (explainInvalid) {
    console.warn("[TimeManager]", explainInvalid, tab);
    return;
  }

  let cfg;
  try {
    await setBadgeBusy();
    cfg = await loadConfig();
    const pipeline = resolvePipelineMode(cfg);

    console.log("[TimeManager] pipeline=", pipeline, "tab=", tab.id, tab.url);

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        title: document.title || "",
        text: document.body ? document.body.innerText : "",
        url: location.href,
      }),
    });
    if (!result?.url) throw new Error("未能读取页面内容");

    logPageCapture(result);

    if (pipeline === "capture_preview") {
      const text = result?.text ?? "";
      const truncated = text.length > MAX_STORED_TEXT;
      const slice = truncated ? text.slice(0, MAX_STORED_TEXT) : text;
      await chrome.storage.local.set({
        [STORAGE_LAST_CAPTURE]: {
          capturedAt: new Date().toISOString(),
          title: result.title ?? "",
          url: result.url ?? "",
          textLen: text.length,
          truncated,
          text: slice,
        },
      });
      await chrome.tabs.create({ url: chrome.runtime.getURL("debug.html"), active: true });
      await setBadgeDone();
      return;
    }

    const { summary: aiSummary, debugRawSnippet } = await summarizePage(result, cfg);

    if (pipeline === "ai_preview") {
      await chrome.storage.local.set({
        [STORAGE_LAST_AI]: {
          capturedAt: new Date().toISOString(),
          title: result.title ?? "",
          url: result.url ?? "",
          aiSummary,
          debugRawSnippet,
        },
      });
      await chrome.tabs.create({ url: chrome.runtime.getURL("ai-preview.html"), active: true });
      await setBadgeDone();
      return;
    }

    await submitCapture(cfg, {
      url: result.url,
      title: result.title,
      pageSnippet: truncate(result.text, 400_000),
      aiSummary,
    });

    await setBadgeDone();
  } catch (e) {
    console.error("[TimeManager] 失败", e);
    await setBadgeDone();
  }
}

chrome.commands.onCommand.addListener((command) => {
  if (command !== "capture-page") return;
  console.log("[TimeManager] 快捷键 capture-page 已触发");
  void (async () => {
    const tab = await getLikelyActiveTab();
    await runPipelineForTab(tab);
  })();
});

chrome.action.onClicked.addListener(() => {
  void chrome.tabs.create({ url: chrome.runtime.getURL("debug.html"), active: true });
});
