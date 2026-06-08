import { useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEllipsisVertical } from "@fortawesome/free-solid-svg-icons";

interface AssetRowActionsProps {
  openMenuLabel: string;
  editLabel: string;
  downloadLabel: string;
  deleteLabel: string;
  downloadDisabled?: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onEdit: () => void;
  onDownload: () => void;
  onDelete: () => void;
}

export function AssetRowActions({
  openMenuLabel,
  editLabel,
  downloadLabel,
  deleteLabel,
  downloadDisabled = false,
  isOpen,
  onToggle,
  onClose,
  onEdit,
  onDownload,
  onDelete,
}: AssetRowActionsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={openMenuLabel}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={onToggle}
        className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition hover:bg-white/5 hover:text-white"
      >
        <FontAwesomeIcon icon={faEllipsisVertical} className="text-sm" />
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-[88px] overflow-hidden rounded-lg border border-white/10 bg-surface py-1 shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onClose();
              onEdit();
            }}
            className="block w-full px-3 py-1.5 text-left text-inherit text-text-muted transition hover:bg-white/5 hover:text-accent"
          >
            {editLabel}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={downloadDisabled}
            onClick={() => {
              if (downloadDisabled) return;
              onClose();
              onDownload();
            }}
            className="block w-full px-3 py-1.5 text-left text-inherit text-text-muted transition hover:bg-white/5 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-text-muted"
          >
            {downloadLabel}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onClose();
              onDelete();
            }}
            className="block w-full px-3 py-1.5 text-left text-inherit text-red-400 transition hover:bg-white/5 hover:text-red-300"
          >
            {deleteLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
