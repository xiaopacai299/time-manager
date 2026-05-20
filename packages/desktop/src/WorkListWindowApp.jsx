import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  WORKLIST_QUADRANT_META,
  getLocalDateKey,
  listDateFromIso,
  normalizeWorklistQuadrant,
} from "@time-manger/shared";
import MemoMonthCalendar, {
  dateKeyToDefaultReminderInput,
} from "./components/MemoMonthCalendar/index.jsx";
import "./WorkListWindowApp.css";

const PRESET_ICONS = ["📋", "📝", "💼", "⏰", "✅", "🎯", "📌", "☕"];
const TAB_TODAY = "today";
const TAB_MEMO = "memo";
const TAB_YEAR = "year";
const MEMO_VIEW_CALENDAR = "calendar";
const MEMO_VIEW_LIST = "list";

/** 象限角标（短标签，完整含义见 title / WORKLIST_QUADRANT_META） */
const QUADRANT_SHORT_TAG = {
  q1: "急重",
  q2: "重要",
  q3: "急件",
  q4: "缓办",
};

const MATRIX_QUADRANTS = ["q2", "q1", "q3", "q4"];
const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];
const MONTH_LABELS = [
  "1月",
  "2月",
  "3月",
  "4月",
  "5月",
  "6月",
  "7月",
  "8月",
  "9月",
  "10月",
  "11月",
  "12月",
];

const MAX_IMAGE_BYTES = 350 * 1024;

export default function WorkListWindowApp() {
  const [items, setItems] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [iconEmoji, setIconEmoji] = useState("📋");
  const [iconCustomDataUrl, setIconCustomDataUrl] = useState("");
  const [name, setName] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [estimateDoneAt, setEstimateDoneAt] = useState("");
  const [note, setNote] = useState("");
  const [quadrant, setQuadrant] = useState("q2");
  /** null | 'worklist' | 'memo' */
  const [activeModal, setActiveModal] = useState(null);
  /** 删除确认：null | { kind: 'worklist' | 'memo', id, name } */
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const nameInputRef = useRef(null);
  const memoNameInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [activeTab, setActiveTab] = useState(TAB_TODAY);
  const [memoItems, setMemoItems] = useState([]);
  const [memoEditingId, setMemoEditingId] = useState("");
  const [memoIconEmoji, setMemoIconEmoji] = useState("📝");
  const [memoIconCustomDataUrl, setMemoIconCustomDataUrl] = useState("");
  const [memoName, setMemoName] = useState("");
  const [memoReminderAt, setMemoReminderAt] = useState("");
  const [memoContent, setMemoContent] = useState("");
  const [memoBusy, setMemoBusy] = useState(false);
  const [memoViewMode, setMemoViewMode] = useState(MEMO_VIEW_CALENDAR);
  const [memoViewYear, setMemoViewYear] = useState(() => new Date().getFullYear());
  const [memoViewMonthIndex, setMemoViewMonthIndex] = useState(() =>
    new Date().getMonth()
  );
  const [memoSelectedDate, setMemoSelectedDate] = useState(() => getLocalDateKey());
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedListDate, setSelectedListDate] = useState(() => getLocalDateKey());

  useEffect(() => {
    if (!message.text) return undefined;
    const timer = setTimeout(() => {
      setMessage({ type: "", text: "" });
    }, 2400);
    return () => clearTimeout(timer);
  }, [message.text]);

  useEffect(() => {
    let mounted = true;
    window.timeManagerAPI?.getWorklist?.().then((list) => {
      if (!mounted) return;
      setItems(Array.isArray(list) ? list : []);
    });
    const off = window.timeManagerAPI?.onWorklistUpdated?.((list) => {
      setItems(Array.isArray(list) ? list : []);
    });
    return () => {
      mounted = false;
      if (off) off();
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    window.timeManagerAPI?.getMemoList?.().then((list) => {
      if (!mounted) return;
      setMemoItems(Array.isArray(list) ? list : []);
    });
    const off = window.timeManagerAPI?.onMemoListUpdated?.((list) => {
      setMemoItems(Array.isArray(list) ? list : []);
    });
    return () => {
      mounted = false;
      if (off) off();
    };
  }, []);

  const resolveListDate = useCallback((item) => {
    const raw = String(item?.listDate || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    return listDateFromIso(item?.createdAt) || getLocalDateKey();
  }, []);

  const todayItems = useMemo(
    () => items.filter((item) => resolveListDate(item) === selectedListDate),
    [items, resolveListDate, selectedListDate]
  );

  const listTitle = useMemo(
    () => `工作清单 (${todayItems.length}) · ${selectedListDate}`,
    [todayItems.length, selectedListDate]
  );
  const memoListTitle = useMemo(
    () => `备忘录 (${memoItems.length})`,
    [memoItems.length]
  );
  const sortedItems = useMemo(() => {
    const parseCreatedTs = (item) => {
      const createdTs = Date.parse(String(item?.createdAt || ""));
      if (Number.isFinite(createdTs)) return createdTs;
      const idPrefix = String(item?.id || "").split("-")[0];
      const idTs = Number(idPrefix);
      return Number.isFinite(idTs) ? idTs : 0;
    };
    return [...todayItems].sort((a, b) => parseCreatedTs(b) - parseCreatedTs(a));
  }, [todayItems]);

  const itemsByQuadrant = useMemo(() => {
    const buckets = { q1: [], q2: [], q3: [], q4: [] };
    for (const item of sortedItems) {
      const q = normalizeWorklistQuadrant(item?.quadrant);
      buckets[q].push(item);
    }
    return buckets;
  }, [sortedItems]);

  const sortedMemos = useMemo(() => {
    const parseCreatedTs = (item) => {
      const createdTs = Date.parse(String(item?.createdAt || ""));
      if (Number.isFinite(createdTs)) return createdTs;
      const idPrefix = String(item?.id || "").split("-")[0];
      const idTs = Number(idPrefix);
      return Number.isFinite(idTs) ? idTs : 0;
    };
    return [...memoItems].sort((a, b) => parseCreatedTs(b) - parseCreatedTs(a));
  }, [memoItems]);

  const isEditing = Boolean(editingId);
  const isMemoEditing = Boolean(memoEditingId);
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!activeModal) return undefined;
    const id = requestAnimationFrame(() => {
      if (activeModal === "worklist") {
        nameInputRef.current?.focus?.({ preventScroll: true });
      } else if (activeModal === "memo") {
        memoNameInputRef.current?.focus?.({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [activeModal, editingId, memoEditingId]);

  const onPickImage = useCallback((event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !file.type.startsWith("image/")) {
      setMessage({ type: "err", text: "请选择图片文件。" });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setMessage({
        type: "err",
        text: "图片过大，请选择约 350KB 以内的图片，或使用上方表情图标。",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result.startsWith("data:image/")) {
        setMessage({ type: "err", text: "无法读取该图片。" });
        return;
      }
      setIconCustomDataUrl(result);
      setMessage({ type: "", text: "" });
    };
    reader.onerror = () => {
      setMessage({ type: "err", text: "读取图片失败。" });
    };
    reader.readAsDataURL(file);
  }, []);

  const clearCustomIcon = useCallback(() => {
    setIconCustomDataUrl("");
  }, []);

  const memoOnPickImage = useCallback((event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !file.type.startsWith("image/")) {
      setMessage({ type: "err", text: "请选择图片文件。" });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setMessage({
        type: "err",
        text: "图片过大，请选择约 350KB 以内的图片，或使用上方表情图标。",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result.startsWith("data:image/")) {
        setMessage({ type: "err", text: "无法读取该图片。" });
        return;
      }
      setMemoIconCustomDataUrl(result);
      setMessage({ type: "", text: "" });
    };
    reader.onerror = () => {
      setMessage({ type: "err", text: "读取图片失败。" });
    };
    reader.readAsDataURL(file);
  }, []);

  const clearMemoCustomIcon = useCallback(() => {
    setMemoIconCustomDataUrl("");
  }, []);

  const onTimeInputClick = useCallback((event) => {
    const input = event.currentTarget;
    if (typeof input?.showPicker === "function") {
      try {
        input.showPicker();
      } catch {
        // 浏览器不允许时保持默认行为，不影响手动输入。
      }
    }
  }, []);

  const openDatePicker = useCallback((input) => {
    if (!input || typeof input.showPicker !== "function") return;
    try {
      input.showPicker();
    } catch {
      // 保持静默
    }
  }, []);

  const onDateFilterMouseDown = useCallback(
    (event) => {
      event.preventDefault();
      const input =
        event.currentTarget instanceof HTMLInputElement
          ? event.currentTarget
          : event.currentTarget
              .closest?.(".worklist-date-filter")
              ?.querySelector?.("input[type='date']");
      openDatePicker(input);
    },
    [openDatePicker]
  );

  function composeTodayDatetime(timeText) {
    const value = String(timeText || "").trim();
    if (!value) return "";
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
    if (!match) return "";
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}T${match[1]}:${match[2]}`;
  }

  function toInputDatetime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (num) => String(num).padStart(2, "0");
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const h = pad(date.getHours());
    const mm = pad(date.getMinutes());
    return `${y}-${m}-${d}T${h}:${mm}`;
  }

  async function onSubmit(event) {
    event.preventDefault();
    setMessage({ type: "", text: "" });
    const trimmedName = name.trim();
    if (!trimmedName) {
      setMessage({ type: "err", text: "请填写工作清单名称。" });
      return;
    }
    const icon = (iconCustomDataUrl || iconEmoji).trim() || "📋";
    setBusy(true);
    try {
      const payload = {
        icon,
        name: trimmedName,
        listDate: selectedListDate,
        quadrant: normalizeWorklistQuadrant(quadrant),
        reminderAt: composeTodayDatetime(reminderAt),
        estimateDoneAt: composeTodayDatetime(estimateDoneAt),
        note: note.trim(),
      };
      const result = isEditing
        ? await window.timeManagerAPI?.updateWorklistItem?.({
            id: editingId,
            ...payload,
          })
        : await window.timeManagerAPI?.addWorklistItem?.(payload);
      if (!result?.ok) {
        setMessage({ type: "err", text: result?.error || "保存失败。" });
        return;
      }
      setItems(Array.isArray(result?.list) ? result.list : []);
      setMessage({ type: "ok", text: isEditing ? "更新成功" : "保存成功" });
      resetForm();
      setActiveModal(null);
    } catch {
      setMessage({ type: "err", text: "保存失败，请稍后重试。" });
    } finally {
      setBusy(false);
    }
  }

  function openDeleteConfirm(kind, id) {
    const targetId = String(id || "").trim();
    if (!targetId) return;
    if (kind === "worklist" && busy) return;
    if (kind === "memo" && memoBusy) return;
    const list = kind === "worklist" ? items : memoItems;
    const row = list.find((item) => String(item?.id) === targetId);
    const label =
      kind === "worklist"
        ? String(row?.name || "").trim() || "这条工作清单"
        : String(row?.name || "").trim() || "这条备忘录";
    setDeleteConfirm({ kind, id: targetId, name: label });
  }

  function closeDeleteConfirm() {
    setDeleteConfirm(null);
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    const { kind, id } = deleteConfirm;
    setDeleteConfirm(null);
    if (kind === "worklist") {
      await performRemoveWorklist(id);
    } else {
      await onRemoveMemoById(id);
    }
  }

  async function performRemoveWorklist(targetId) {
    if (!targetId || busy) return;
    setBusy(true);
    setMessage({ type: "", text: "" });
    try {
      const result = await window.timeManagerAPI?.removeWorklistItem?.({
        id: targetId,
      });
      if (!result?.ok) {
        setMessage({ type: "err", text: result?.error || "删除失败。" });
        return;
      }
      setItems(Array.isArray(result?.list) ? result.list : []);
      if (editingId === targetId) {
        setActiveModal(null);
        resetForm();
      }
      setMessage({ type: "ok", text: "删除成功。" });
    } catch {
      setMessage({ type: "err", text: "删除失败，请稍后重试。" });
    } finally {
      setBusy(false);
    }
  }

  function formatDatetime(value) {
    if (!value) return "未设置";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "时间格式无效";
    return date.toLocaleString();
  }

  function getStatusMeta(item) {
    const completion = String(item?.completionResult || "").trim();
    if (completion === "completed") {
      return { label: "完成", title: "已完成", cls: "done" };
    }
    if (completion === "incomplete") {
      return { label: "未完", title: "未完成", cls: "undone" };
    }
    const now = nowTick;
    const reminderTs = Date.parse(String(item?.reminderAt || ""));
    const estimateTs = Date.parse(String(item?.estimateDoneAt || ""));
    const hasReminder = Number.isFinite(reminderTs);
    const hasEstimate = Number.isFinite(estimateTs);
    if (hasReminder && hasEstimate && now >= reminderTs && now < estimateTs) {
      return { label: "进行", title: "完成中", cls: "doing" };
    }
    if (!hasReminder && hasEstimate && now < estimateTs) {
      return { label: "待办", title: "待完成", cls: "pending" };
    }
    if (hasEstimate && now >= estimateTs) {
      return { label: "进行", title: "完成中", cls: "doing" };
    }
    if (hasReminder && now < reminderTs) {
      return { label: "待办", title: "待完成", cls: "pending" };
    }
    return { label: "待办", title: "待完成", cls: "pending" };
  }

  function toInputTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (num) => String(num).padStart(2, "0");
    const h = pad(date.getHours());
    const mm = pad(date.getMinutes());
    return `${h}:${mm}`;
  }

  function fillFormByItem(item) {
    if (!item) return;
    const icon = String(item.icon || "").trim() || "📋";
    if (icon.startsWith("data:image/")) {
      setIconCustomDataUrl(icon);
      setIconEmoji("📋");
    } else {
      setIconEmoji(icon);
      setIconCustomDataUrl("");
    }
    setName(String(item.name || ""));
    setReminderAt(toInputTime(item.reminderAt));
    setEstimateDoneAt(toInputTime(item.estimateDoneAt));
    setNote(String(item.note || ""));
    setQuadrant(normalizeWorklistQuadrant(item.quadrant));
    setEditingId(String(item.id || ""));
    setMessage({ type: "", text: "" });
  }

  function resetForm() {
    setEditingId("");
    setIconEmoji("📋");
    setIconCustomDataUrl("");
    setName("");
    setReminderAt("");
    setEstimateDoneAt("");
    setNote("");
    setQuadrant("q2");
    setMessage({ type: "", text: "" });
  }

  function openAddModalForQuadrant(q, event) {
    event?.stopPropagation?.();
    event?.preventDefault?.();
    resetForm();
    setQuadrant(normalizeWorklistQuadrant(q));
    setActiveModal("worklist");
  }

  function openEditModal(item, event) {
    event?.stopPropagation?.();
    fillFormByItem(item);
    setActiveModal("worklist");
  }

  function closeActiveModal() {
    setActiveModal(null);
    resetForm();
    resetMemoForm();
  }

  function openMemoAddModal(event, options = {}) {
    event?.stopPropagation?.();
    event?.preventDefault?.();
    resetMemoForm();
    const dateKey = String(options.dateKey || "").trim();
    if (dateKey) {
      setMemoSelectedDate(dateKey);
      setMemoReminderAt(dateKeyToDefaultReminderInput(dateKey));
    }
    setActiveModal("memo");
  }

  function openMemoAddModalForDate(dateKey, event) {
    openMemoAddModal(event, { dateKey });
  }

  function openMemoEditModal(item, event) {
    event?.stopPropagation?.();
    fillMemoFormByItem(item);
    setActiveModal("memo");
  }

  function getMemoReminderMeta(item) {
    if (!String(item?.reminderAt || "").trim()) {
      return { label: "无", title: "未设提醒", cls: "pending" };
    }
    if (item.reminderNotified) {
      return { label: "已响", title: "已提醒", cls: "done" };
    }
    const t = Date.parse(String(item.reminderAt || ""));
    if (Number.isFinite(t) && nowTick >= t) {
      return { label: "待响", title: "待提醒", cls: "doing" };
    }
    return { label: "预定", title: "已设置提醒", cls: "pending" };
  }

  function fillMemoFormByItem(item) {
    if (!item) return;
    const icon = String(item.icon || "").trim() || "📝";
    if (icon.startsWith("data:image/")) {
      setMemoIconCustomDataUrl(icon);
      setMemoIconEmoji("📝");
    } else {
      setMemoIconEmoji(icon);
      setMemoIconCustomDataUrl("");
    }
    setMemoName(String(item.name || ""));
    setMemoReminderAt(toInputDatetime(item.reminderAt));
    setMemoContent(String(item.content || ""));
    setMemoEditingId(String(item.id || ""));
    setMessage({ type: "", text: "" });
  }

  function resetMemoForm() {
    setMemoEditingId("");
    setMemoIconEmoji("📝");
    setMemoIconCustomDataUrl("");
    setMemoName("");
    setMemoReminderAt("");
    setMemoContent("");
    setMessage({ type: "", text: "" });
  }

  async function onMemoSubmit(event) {
    event.preventDefault();
    setMessage({ type: "", text: "" });
    const trimmedName = memoName.trim();
    if (!trimmedName) {
      setMessage({ type: "err", text: "请填写备忘录名称。" });
      return;
    }
    const trimmed = memoContent.trim();
    if (!trimmed) {
      setMessage({ type: "err", text: "请填写备忘录内容。" });
      return;
    }
    const icon = (memoIconCustomDataUrl || memoIconEmoji).trim() || "📝";
    const reminderIso = memoReminderAt.trim();
    setMemoBusy(true);
    try {
      const payload = {
        icon,
        name: trimmedName,
        reminderAt: reminderIso,
        content: trimmed,
      };
      const result = isMemoEditing
        ? await window.timeManagerAPI?.updateMemoItem?.({
            id: memoEditingId,
            ...payload,
          })
        : await window.timeManagerAPI?.addMemoItem?.(payload);
      if (!result?.ok) {
        setMessage({ type: "err", text: result?.error || "保存失败。" });
        return;
      }
      setMemoItems(Array.isArray(result?.list) ? result.list : []);
      setMessage({
        type: "ok",
        text: isMemoEditing ? "备忘录已更新" : "备忘录已保存",
      });
      resetMemoForm();
      setActiveModal(null);
    } catch {
      setMessage({ type: "err", text: "保存失败，请稍后重试。" });
    } finally {
      setMemoBusy(false);
    }
  }

  async function onRemoveMemoById(id) {
    const targetId = String(id || "").trim();
    if (!targetId || memoBusy) return;
    setMemoBusy(true);
    setMessage({ type: "", text: "" });
    try {
      const result = await window.timeManagerAPI?.removeMemoItem?.({
        id: targetId,
      });
      if (!result?.ok) {
        setMessage({ type: "err", text: result?.error || "删除失败。" });
        return;
      }
      setMemoItems(Array.isArray(result?.list) ? result.list : []);
      if (memoEditingId === targetId) {
        setActiveModal(null);
        resetMemoForm();
      }
      setMessage({ type: "ok", text: "已删除。" });
    } catch {
      setMessage({ type: "err", text: "删除失败，请稍后重试。" });
    } finally {
      setMemoBusy(false);
    }
  }

  const yearOptions = useMemo(
    () => Array.from({ length: 5 }, (_, i) => currentYear - i),
    [currentYear]
  );

  const yearHeatmap = useMemo(() => {
    const year = selectedYear;
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);
    const start = new Date(yearStart);
    start.setDate(start.getDate() - start.getDay());

    const dayCountMap = new Map();
    for (const item of items) {
      const rawTime = item?.reminderAt || item?.estimateDoneAt;
      const date = new Date(rawTime || "");
      if (Number.isNaN(date.getTime())) continue;
      if (date.getFullYear() !== year) continue;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(date.getDate()).padStart(2, "0")}`;
      dayCountMap.set(key, (dayCountMap.get(key) || 0) + 1);
    }

    const cells = [];
    const monthMarkers = [];
    let cur = new Date(start);
    while (cur <= yearEnd) {
      const weekIndex = Math.floor(
        (cur.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)
      );
      const day = cur.getDay();
      const dateKey = `${cur.getFullYear()}-${String(
        cur.getMonth() + 1
      ).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
      const count = dayCountMap.get(dateKey) || 0;
      const inCurrentYear = cur >= yearStart && cur <= yearEnd;
      const level = !inCurrentYear
        ? -1
        : count === 0
        ? 1
        : count <= 2
        ? 2
        : count <= 5
        ? 3
        : 4;
      cells.push({
        key: `${weekIndex}-${day}`,
        weekIndex,
        day,
        dateKey,
        count,
        level,
        inCurrentYear,
      });

      if (cur.getDate() === 1 && cur >= yearStart && cur <= yearEnd) {
        monthMarkers.push({
          month: cur.getMonth(),
          weekIndex,
        });
      }
      cur.setDate(cur.getDate() + 1);
    }

    return {
      year,
      cells,
      monthMarkers,
      weekColumns:
        Math.floor(
          (yearEnd.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)
        ) + 1,
      totalPlans: Array.from(dayCountMap.values()).reduce(
        (sum, n) => sum + n,
        0
      ),
      activeDays: dayCountMap.size,
    };
  }, [items, selectedYear]);

  function renderWorklistCard(item) {
    const icon = String(item.icon || "").trim() || "📋";
    const status = getStatusMeta(item);
    const note = String(item.note || "").trim();
    const q = normalizeWorklistQuadrant(item.quadrant);
    return (
      <article
        key={item.id}
        className={`worklist-item worklist-item--card worklist-item--q-${q}${
          editingId === item.id ? " worklist-item--active" : ""
        }`}
        onClick={(event) => openEditModal(item, event)}
      >
        <div className="worklist-item-row">
          <div className="worklist-item-head-main">
            {icon.startsWith("data:image/") ? (
              <img className="worklist-item-icon-image" src={icon} alt="" />
            ) : (
              <span className="worklist-item-icon-emoji">{icon}</span>
            )}
            <h2 className="worklist-item-name">{item.name}</h2>
          </div>
          <span
            className={`worklist-status-pill worklist-status-pill--${status.cls}`}
            title={status.title}
          >
            <span className="worklist-status-pill__dot" aria-hidden="true" />
            <span className="worklist-status-pill__label">{status.label}</span>
          </span>
          <button
            type="button"
            className="worklist-item-delete"
            disabled={busy}
            aria-label="删除"
            title="删除"
            onClick={(event) => {
              event.stopPropagation();
              openDeleteConfirm("worklist", item.id);
            }}
          >
            <span className="worklist-item-delete__icon" aria-hidden="true">
              ×
            </span>
          </button>
        </div>
        {note ? (
          <p className="worklist-item-note" title={note}>
            {note}
          </p>
        ) : null}
      </article>
    );
  }

  const worklistFormFields = (
    <>
      <div className="worklist-field">
        <label>图标</label>
        <div className="worklist-icon-row">
          {PRESET_ICONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className={`worklist-icon-btn${
                iconEmoji === emoji && !iconCustomDataUrl
                  ? " worklist-icon-btn--active"
                  : ""
              }`}
              title={emoji}
              onClick={() => {
                setIconEmoji(emoji);
                setIconCustomDataUrl("");
              }}
            >
              {emoji}
            </button>
          ))}
          {iconCustomDataUrl ? (
            <>
              <img
                className="worklist-icon-preview"
                src={iconCustomDataUrl}
                alt=""
              />
              <button
                type="button"
                className="worklist-btn-secondary"
                onClick={clearCustomIcon}
              >
                清除自定义图
              </button>
            </>
          ) : null}
          <label className="worklist-file">
            <input type="file" accept="image/*" onChange={onPickImage} hidden />
            <span
              style={{ cursor: "pointer", textDecoration: "underline" }}
            >
              上传自定义图标…
            </span>
          </label>
        </div>
      </div>

      <div className="worklist-field">
        <label htmlFor="wl-name">
          工作清单名称 <span className="req">*</span>
        </label>
        <input
          ref={nameInputRef}
          id="wl-name"
          className="worklist-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如：写完周报"
          maxLength={200}
          autoComplete="off"
        />
      </div>

      <div className="worklist-field">
        <label htmlFor="wl-remind">提醒时间</label>
        <input
          id="wl-remind"
          className="worklist-input"
          type="time"
          step="60"
          value={reminderAt}
          onClick={onTimeInputClick}
          onChange={(e) => setReminderAt(e.target.value)}
        />
      </div>

      <div className="worklist-field">
        <label htmlFor="wl-est">估计完成时间</label>
        <input
          id="wl-est"
          className="worklist-input"
          type="time"
          step="60"
          value={estimateDoneAt}
          onClick={onTimeInputClick}
          onChange={(e) => setEstimateDoneAt(e.target.value)}
        />
      </div>

      <div className="worklist-field">
        <label htmlFor="wl-note">备注（写给自己的提醒）</label>
        <textarea
          id="wl-note"
          className="worklist-textarea"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="例如：别忘带电源、先做第 3 节…"
          maxLength={2000}
        />
      </div>
    </>
  );

  function renderMemoCard(item) {
    const mIcon = String(item.icon || "").trim() || "📝";
    const status = getMemoReminderMeta(item);
    const preview = String(item.content || "").trim();
    return (
      <article
        key={item.id}
        className={`worklist-item worklist-item--card worklist-item--memo${
          memoEditingId === item.id ? " worklist-item--active" : ""
        }`}
        onClick={(event) => openMemoEditModal(item, event)}
      >
        <div className="worklist-item-row">
          <div className="worklist-item-head-main">
            {mIcon.startsWith("data:image/") ? (
              <img className="worklist-item-icon-image" src={mIcon} alt="" />
            ) : (
              <span className="worklist-item-icon-emoji" aria-hidden="true">
                {mIcon}
              </span>
            )}
            <h2 className="worklist-item-name">{item.name || "备忘录"}</h2>
          </div>
          <span
            className={`worklist-status-pill worklist-status-pill--${status.cls}`}
            title={status.title}
          >
            <span className="worklist-status-pill__dot" aria-hidden="true" />
            <span className="worklist-status-pill__label">{status.label}</span>
          </span>
          <button
            type="button"
            className="worklist-item-delete"
            disabled={memoBusy}
            aria-label="删除"
            title="删除"
            onClick={(event) => {
              event.stopPropagation();
              openDeleteConfirm("memo", item.id);
            }}
          >
            <span className="worklist-item-delete__icon" aria-hidden="true">
              ×
            </span>
          </button>
        </div>
        {preview ? (
          <p className="worklist-item-note" title={preview}>
            {preview}
          </p>
        ) : null}
      </article>
    );
  }

  const memoFormFields = (
    <>
      <div className="worklist-field">
        <label>图标</label>
        <div className="worklist-icon-row">
          {PRESET_ICONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className={`worklist-icon-btn${
                memoIconEmoji === emoji && !memoIconCustomDataUrl
                  ? " worklist-icon-btn--active"
                  : ""
              }`}
              title={emoji}
              onClick={() => {
                setMemoIconEmoji(emoji);
                setMemoIconCustomDataUrl("");
              }}
            >
              {emoji}
            </button>
          ))}
          {memoIconCustomDataUrl ? (
            <>
              <img
                className="worklist-icon-preview"
                src={memoIconCustomDataUrl}
                alt=""
              />
              <button
                type="button"
                className="worklist-btn-secondary"
                onClick={clearMemoCustomIcon}
              >
                清除自定义图
              </button>
            </>
          ) : null}
          <label className="worklist-file">
            <input
              type="file"
              accept="image/*"
              onChange={memoOnPickImage}
              hidden
            />
            <span
              style={{ cursor: "pointer", textDecoration: "underline" }}
            >
              上传自定义图标…
            </span>
          </label>
        </div>
      </div>

      <div className="worklist-field">
        <label htmlFor="memo-name">
          名称 <span className="req">*</span>
        </label>
        <input
          ref={memoNameInputRef}
          id="memo-name"
          className="worklist-input"
          value={memoName}
          onChange={(e) => setMemoName(e.target.value)}
          placeholder="例如：下午开会材料"
          maxLength={200}
          autoComplete="off"
        />
      </div>

      <div className="worklist-field">
        <label htmlFor="memo-remind">提醒时间</label>
        <input
          id="memo-remind"
          className="worklist-input"
          type="datetime-local"
          step="60"
          value={memoReminderAt}
          onClick={onTimeInputClick}
          onChange={(e) => setMemoReminderAt(e.target.value)}
        />
      </div>

      <div className="worklist-field">
        <label htmlFor="memo-content">
          内容 <span className="req">*</span>
        </label>
        <textarea
          id="memo-content"
          className="worklist-textarea worklist-textarea--memo-body"
          value={memoContent}
          onChange={(e) => setMemoContent(e.target.value)}
          placeholder="写在这里…"
          maxLength={50000}
          spellCheck="false"
        />
      </div>
    </>
  );

  return (
    <main className="worklist-page">
      {message.text ? (
        <div
          className={`worklist-toast ${
            message.type === "ok" ? "worklist-toast--ok" : "worklist-toast--err"
          }`}
        >
          {message.text}
        </div>
      ) : null}
      <div className="worklist-tabs">
        <span
          className={`worklist-tab-indicator${
            activeTab === TAB_YEAR
              ? " worklist-tab-indicator--year"
              : activeTab === TAB_MEMO
              ? " worklist-tab-indicator--memo"
              : " worklist-tab-indicator--today"
          }`}
          aria-hidden="true"
        />
        <button
          type="button"
          className={`worklist-tab-btn${
            activeTab === TAB_TODAY ? " worklist-tab-btn--active" : ""
          }`}
          onClick={() => setActiveTab(TAB_TODAY)}
        >
          今日计划
        </button>
        <button
          type="button"
          className={`worklist-tab-btn${
            activeTab === TAB_MEMO ? " worklist-tab-btn--active" : ""
          }`}
          onClick={() => setActiveTab(TAB_MEMO)}
        >
          备忘录
        </button>
        <button
          type="button"
          className={`worklist-tab-btn${
            activeTab === TAB_YEAR ? " worklist-tab-btn--active" : ""
          }`}
          onClick={() => setActiveTab(TAB_YEAR)}
        >
          今年工作总鉴
        </button>
      </div>

      {activeTab === TAB_TODAY ? (
        <div className="worklist-wrap worklist-content worklist-content--today worklist-content--tab-switch">
          <section className="worklist-pane worklist-pane--today">
            <div className="worklist-today-header">
              <h1 className="worklist-title">{listTitle}</h1>
              <div className="worklist-today-header-actions">
                <label className="worklist-date-filter">
                  <span onMouseDown={onDateFilterMouseDown}>查看日期</span>
                  <input
                    type="date"
                    value={selectedListDate}
                    onMouseDown={onDateFilterMouseDown}
                    onChange={(e) =>
                      setSelectedListDate(e.target.value || getLocalDateKey())
                    }
                  />
                </label>
                <button
                  type="button"
                  className="worklist-export-btn"
                  onClick={() => {
                    window.timeManagerAPI?.openWorklistExport?.();
                  }}
                >
                  导出日志
                </button>
              </div>
            </div>
            <div className="worklist-list-wrap">
              <div className="worklist-matrix-shell">
                <span className="worklist-matrix-corner" aria-hidden="true" />
                <span
                  className="worklist-matrix-col-label worklist-matrix-col-label--not-urgent"
                  aria-hidden="true"
                >
                  不紧急
                </span>
                <span
                  className="worklist-matrix-col-label worklist-matrix-col-label--urgent"
                  aria-hidden="true"
                >
                  紧急
                </span>
                <span
                  className="worklist-matrix-row-label worklist-matrix-row-label--important"
                  aria-hidden="true"
                >
                  重要
                </span>
                <span
                  className="worklist-matrix-row-label worklist-matrix-row-label--not-important"
                  aria-hidden="true"
                >
                  不重要
                </span>
                <div className="worklist-matrix-board">
                  <div className="worklist-matrix-cross" aria-hidden="true" />
                  <div className="worklist-quadrant-matrix">
                    {MATRIX_QUADRANTS.map((q) => {
                      const meta = WORKLIST_QUADRANT_META[q];
                      const quadrantItems = itemsByQuadrant[q] || [];
                      return (
                        <section
                          key={q}
                          className={`worklist-quadrant worklist-quadrant--${q}`}
                          aria-label={meta.label}
                        >
                          <header className="worklist-quadrant-head">
                            <span
                              className={`worklist-quadrant-tag worklist-quadrant-tag--${q}`}
                              title={meta.label}
                            >
                              {QUADRANT_SHORT_TAG[q]}
                            </span>
                            <span
                              className="worklist-quadrant-count"
                              title={`${quadrantItems.length} 项`}
                            >
                              {quadrantItems.length}
                            </span>
                            <button
                              type="button"
                              className="worklist-quadrant-add"
                              title={meta.label}
                              aria-label={`添加 · ${meta.label}`}
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => openAddModalForQuadrant(q, e)}
                            >
                              +
                            </button>
                          </header>
                          <div className="worklist-quadrant-list">
                            {quadrantItems.length === 0 ? (
                              <span
                                className="worklist-quadrant-empty"
                                aria-hidden="true"
                              >
                                —
                              </span>
                            ) : (
                              quadrantItems.map((item) =>
                                renderWorklistCard(item)
                              )
                            )}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>

        </div>
      ) : activeTab === TAB_MEMO ? (
        <div className="worklist-wrap worklist-content worklist-content--memo worklist-content--tab-switch">
          <section className="worklist-pane worklist-pane--memo">
            <div className="worklist-memo-header">
              <h1 className="worklist-title">{memoListTitle}</h1>
              <div className="worklist-memo-header-actions">
                <div
                  className="worklist-memo-view-toggle"
                  role="tablist"
                  aria-label="备忘录视图"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={memoViewMode === MEMO_VIEW_CALENDAR}
                    className={`worklist-memo-view-btn${
                      memoViewMode === MEMO_VIEW_CALENDAR
                        ? " worklist-memo-view-btn--active"
                        : ""
                    }`}
                    onClick={() => setMemoViewMode(MEMO_VIEW_CALENDAR)}
                  >
                    日历
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={memoViewMode === MEMO_VIEW_LIST}
                    className={`worklist-memo-view-btn${
                      memoViewMode === MEMO_VIEW_LIST
                        ? " worklist-memo-view-btn--active"
                        : ""
                    }`}
                    onClick={() => setMemoViewMode(MEMO_VIEW_LIST)}
                  >
                    列表
                  </button>
                </div>
                <button
                  type="button"
                  className="worklist-add-btn"
                  onClick={(e) =>
                    openMemoAddModal(e, {
                      dateKey: memoSelectedDate || getLocalDateKey(),
                    })
                  }
                >
                  添加
                </button>
              </div>
            </div>
            {memoViewMode === MEMO_VIEW_CALENDAR ? (
              <MemoMonthCalendar
                items={memoItems}
                viewYear={memoViewYear}
                viewMonthIndex={memoViewMonthIndex}
                selectedDate={memoSelectedDate}
                onViewMonthChange={(year, monthIndex) => {
                  setMemoViewYear(year);
                  setMemoViewMonthIndex(monthIndex);
                }}
                onSelectDate={setMemoSelectedDate}
                onAddForDate={(dateKey) => openMemoAddModalForDate(dateKey)}
                onEditItem={(item) => openMemoEditModal(item)}
              />
            ) : (
              <div className="worklist-list">
                {sortedMemos.length === 0 ? (
                  <span className="worklist-quadrant-empty" aria-hidden="true">
                    —
                  </span>
                ) : (
                  sortedMemos.map((item) => renderMemoCard(item))
                )}
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="worklist-wrap worklist-wrap--year worklist-content worklist-content--year worklist-content--tab-switch">
          <section className="worklist-pane worklist-pane--year">
            <h2 className="worklist-title">年度工作总鉴</h2>
            <p className="worklist-sub">
              {yearHeatmap.year} 年共记录{" "}
              <strong>{yearHeatmap.totalPlans}</strong> 个清单项，覆盖
              <strong> {yearHeatmap.activeDays} </strong>天。
            </p>
            <div className="year-overview">
              <div className="year-heatmap">
                <div className="year-heatmap-row">
                  <div className="year-heatmap-core">
                    <div
                      className="year-heatmap-months"
                      style={{
                        gridTemplateColumns: `repeat(${yearHeatmap.weekColumns}, 12px)`,
                      }}
                    >
                      {yearHeatmap.monthMarkers.map((marker) => (
                        <span
                          key={`${marker.month}-${marker.weekIndex}`}
                          className="year-heatmap-month"
                          style={{ gridColumnStart: marker.weekIndex + 1 }}
                        >
                          {MONTH_LABELS[marker.month]}
                        </span>
                      ))}
                    </div>
                    <div className="year-heatmap-main">
                      <div className="year-heatmap-weekdays">
                        {WEEKDAY_LABELS.map((label) => (
                          <span key={label} className="year-heatmap-weekday">
                            {label}
                          </span>
                        ))}
                      </div>
                      <div
                        className="year-heatmap-grid"
                        style={{
                          gridTemplateColumns: `repeat(${yearHeatmap.weekColumns}, 12px)`,
                        }}
                      >
                        {yearHeatmap.cells.map((cell) => (
                          <span
                            key={cell.key}
                            className={`year-heatmap-cell year-heatmap-cell--lv${cell.level}`}
                            style={{
                              gridColumnStart: cell.weekIndex + 1,
                              gridRowStart: cell.day + 1,
                            }}
                            title={`${cell.dateKey}：完成 ${cell.count} 项`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="year-heatmap-legend">
                    <span>少</span>
                    <span className="year-heatmap-cell year-heatmap-cell--lv1" />
                    <span className="year-heatmap-cell year-heatmap-cell--lv2" />
                    <span className="year-heatmap-cell year-heatmap-cell--lv3" />
                    <span className="year-heatmap-cell year-heatmap-cell--lv4" />
                    <span>多</span>
                  </div>
                </div>
              </div>
              <aside className="year-selector" aria-label="年度选择器">
                {yearOptions.map((year) => (
                  <button
                    key={year}
                    type="button"
                    className={`year-selector-item${
                      year === selectedYear ? " year-selector-item--active" : ""
                    }`}
                    onClick={() => setSelectedYear(year)}
                  >
                    {year} 年
                  </button>
                ))}
              </aside>
            </div>
          </section>
        </div>
      )}
      {activeModal && typeof document !== "undefined"
        ? createPortal(
            <div
              className="worklist-modal-overlay"
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) {
                  e.preventDefault();
                }
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  closeActiveModal();
                }
              }}
            >
              <div
                className="worklist-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="worklist-modal-title"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="worklist-form-header">
                  <div>
                    <h2 className="worklist-title" id="worklist-modal-title">
                      {activeModal === "memo"
                        ? isMemoEditing
                          ? "编辑备忘录"
                          : "添加备忘录"
                        : isEditing
                          ? "编辑工作清单"
                          : "添加工作清单"}
                    </h2>
                  </div>
                  <button
                    type="button"
                    className="worklist-modal-close"
                    aria-label="关闭"
                    onClick={closeActiveModal}
                  >
                    ×
                  </button>
                </div>
                {activeModal === "memo" ? (
                  <form className="worklist-form" onSubmit={onMemoSubmit}>
                    {memoFormFields}
                    <div className="worklist-actions">
                      <button
                        type="submit"
                        className="worklist-submit"
                        disabled={memoBusy}
                      >
                        {memoBusy
                          ? "保存中…"
                          : isMemoEditing
                            ? "保存修改"
                            : "保存备忘录"}
                      </button>
                      <button
                        type="button"
                        className="worklist-btn-secondary"
                        onClick={closeActiveModal}
                        disabled={memoBusy}
                      >
                        取消
                      </button>
                    </div>
                  </form>
                ) : (
                  <form className="worklist-form" onSubmit={onSubmit}>
                    {worklistFormFields}
                    <div className="worklist-actions">
                      <button
                        type="submit"
                        className="worklist-submit"
                        disabled={busy}
                      >
                        {busy
                          ? "保存中…"
                          : isEditing
                            ? "保存修改"
                            : "保存工作清单"}
                      </button>
                      <button
                        type="button"
                        className="worklist-btn-secondary"
                        onClick={closeActiveModal}
                        disabled={busy}
                      >
                        取消
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
      {deleteConfirm && typeof document !== "undefined"
        ? createPortal(
            <div
              className="worklist-modal-overlay"
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) {
                  e.preventDefault();
                }
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  closeDeleteConfirm();
                }
              }}
            >
              <div
                className="worklist-modal worklist-modal--confirm"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="worklist-delete-title"
                aria-describedby="worklist-delete-desc"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="worklist-form-header">
                  <div>
                    <h2 className="worklist-title" id="worklist-delete-title">
                      确认删除
                    </h2>
                  </div>
                  <button
                    type="button"
                    className="worklist-modal-close"
                    aria-label="关闭"
                    onClick={closeDeleteConfirm}
                    disabled={busy || memoBusy}
                  >
                    ×
                  </button>
                </div>
                <p className="worklist-confirm-text" id="worklist-delete-desc">
                  {deleteConfirm.kind === "memo"
                    ? `确认删除备忘录「${deleteConfirm.name}」吗？此操作不可撤销。`
                    : `确认删除工作清单「${deleteConfirm.name}」吗？此操作不可撤销。`}
                </p>
                <div className="worklist-actions worklist-actions--confirm">
                  <button
                    type="button"
                    className="worklist-btn-danger"
                    disabled={busy || memoBusy}
                    onClick={() => void confirmDelete()}
                  >
                    {busy || memoBusy ? "删除中…" : "确认删除"}
                  </button>
                  <button
                    type="button"
                    className="worklist-btn-secondary"
                    onClick={closeDeleteConfirm}
                    disabled={busy || memoBusy}
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </main>
  );
}
