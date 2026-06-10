import { useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEllipsisVertical } from "@fortawesome/free-solid-svg-icons";

interface VideoScriptRowActionsProps {
  openMenuLabel: string;
  editLabel: string;
  generateLabel: string;
  editDisabled?: boolean;
  generateDisabled?: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onEdit: () => void;
  onGenerate: () => void;
}

export function VideoScriptRowActions({
  openMenuLabel,
  editLabel,
  generateLabel,
  editDisabled = false,
  generateDisabled = false,
  isOpen,
  onToggle,
  onClose,
  onEdit,
  onGenerate,
}: VideoScriptRowActionsProps) {
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
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition hover:bg-white/5 hover:text-white"
      >
        <FontAwesomeIcon icon={faEllipsisVertical} className="text-sm" />
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-[108px] overflow-hidden rounded-lg border border-white/10 bg-surface py-1 shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            disabled={editDisabled}
            onClick={(event) => {
              event.stopPropagation();
              if (editDisabled) return;
              onClose();
              onEdit();
            }}
            className="block w-full px-3 py-1.5 text-left text-inherit text-text-muted transition hover:bg-white/5 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-text-muted"
          >
            {editLabel}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={generateDisabled}
            onClick={(event) => {
              event.stopPropagation();
              if (generateDisabled) return;
              onClose();
              onGenerate();
            }}
            className="block w-full px-3 py-1.5 text-left text-inherit text-text-muted transition hover:bg-white/5 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-text-muted"
          >
            {generateLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
