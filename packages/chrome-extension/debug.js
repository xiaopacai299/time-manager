const STORAGE_KEY = "tmLastPageCapture";

document.addEventListener("DOMContentLoaded", async () => {
  const meta = document.getElementById("meta");
  const body = document.getElementById("body");
  try {
    const { [STORAGE_KEY]: data } = await chrome.storage.local.get(STORAGE_KEY);
    if (!data || typeof data !== "object") {
      meta.textContent = "暂无数据：请先在选项中勾选「仅验证抓取」，再在网页右键使用菜单。";
      body.textContent = "";
      body.classList.add("empty");
      return;
    }
    const { capturedAt, title, url, textLen, truncated, text } = data;
    meta.textContent = "";
    meta.append(buildMeta(capturedAt, title, url, textLen, !!truncated));
    body.textContent = typeof text === "string" ? text : "";
  } catch (e) {
    meta.textContent = "读取失败：" + (e instanceof Error ? e.message : String(e));
    body.textContent = "";
  }
});

function safeHref(u) {
  const s = String(u);
  return /^https?:\/\//i.test(s) ? s : null;
}

function buildMeta(capturedAt, title, url, textLen, truncated) {
  const frag = document.createDocumentFragment();
  frag.append("抓取时间：", bold(String(capturedAt || "—")), document.createElement("br"));
  frag.append("标题：", bold(String(title || "")), document.createElement("br"));

  const u = safeHref(url);
  const linkText = document.createElement("span");
  if (u) {
    const a = document.createElement("a");
    a.href = u;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = url;
    linkText.append(a);
  } else {
    linkText.textContent = String(url || "");
  }
  frag.append(linkText, document.createElement("br"));

  frag.append(`正文字符数：${textLen ?? 0}`);
  if (truncated) frag.append("（正文已在存储时截断，超长页防占满配额）");
  return frag;
}

function bold(t) {
  const s = document.createElement("strong");
  s.textContent = t;
  return s;
}
