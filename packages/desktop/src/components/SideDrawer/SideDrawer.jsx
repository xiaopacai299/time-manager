import { useEffect } from "react";
import { createPortal } from "react-dom";
import "./SideDrawer.css";

/**
 * 右侧滑出抽屉（遮罩 + 面板），通过 Portal 挂到 document.body。
 */
export default function SideDrawer({
  open,
  onClose,
  title,
  children,
  side = "right",
  width = "min(360px, 92vw)",
  ariaLabel,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className={`tm-side-drawer tm-side-drawer--${side}`}
      role="presentation"
    >
      <button
        type="button"
        className="tm-side-drawer__backdrop"
        aria-label="关闭"
        onClick={onClose}
      />
      <aside
        className="tm-side-drawer__panel"
        style={{ width }}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || title || "抽屉"}
      >
        <header className="tm-side-drawer__head">
          {title ? <h2 className="tm-side-drawer__title">{title}</h2> : null}
          <button
            type="button"
            className="tm-side-drawer__close"
            aria-label="关闭"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="tm-side-drawer__body">{children}</div>
      </aside>
    </div>,
    document.body
  );
}
