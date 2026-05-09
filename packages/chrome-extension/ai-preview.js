const KEY = "tmLastAiPreview";

document.addEventListener("DOMContentLoaded", async () => {
  const meta = document.getElementById("meta");
  const summary = document.getElementById("summary");
  const rawBox = document.getElementById("rawBox");

  try {
    const { [KEY]: row } = await chrome.storage.local.get(KEY);
    if (!row || typeof row !== "object") {
      meta.textContent =
        '暂无 AI 预览数据。请将选项设为「抓取 + 调用 AI，仅预览（不上传）」，然后按快捷键（默认 Ctrl+Q）触发。可到 chrome://extensions/shortcuts 修改快捷键。';
      summary.textContent = "";
      summary.classList.add("empty");
      rawBox.textContent = "";
      return;
    }

    meta.textContent = "";
    meta.append(`调用时间：${String(row.capturedAt || "—")}`, document.createElement("br"));
    meta.append(`标题：${String(row.title || "")}`, document.createElement("br"));
    const u = typeof row.url === "string" ? row.url : "";
    if (/^https?:\/\//i.test(u)) {
      const a = document.createElement("a");
      a.href = u;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = u;
      meta.append("网址：", a);
    } else {
      meta.append(document.createTextNode("网址：" + u));
    }

    summary.textContent =
      typeof row.aiSummary === "string" && row.aiSummary.trim()
        ? row.aiSummary
        : "（未能解析正文，请查看下方原始 JSON）";
    rawBox.textContent =
      typeof row.debugRawSnippet === "string" ? row.debugRawSnippet : "(无原始响应快照)";
  } catch (e) {
    meta.textContent = "读取失败：" + (e instanceof Error ? e.message : String(e));
    summary.textContent = "";
    rawBox.textContent = "";
  }
});
