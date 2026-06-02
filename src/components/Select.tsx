import { useEffect, useId, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const triggerClass =
  "box-border flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-white/10 bg-surface px-3 text-sm text-white outline-none transition hover:border-white/20 focus:outline-none focus-visible:border-accent/50 disabled:cursor-not-allowed disabled:opacity-50";

export function Select({
  value,
  options,
  onChange,
  placeholder,
  disabled,
  className,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const selected = options.find((o) => o.value === value);
  const display = selected?.label ?? placeholder ?? "";
  const showPlaceholder = !selected && Boolean(placeholder);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`${triggerClass} ${open ? "border-accent/50" : ""}`}
      >
        <span
          className={`truncate ${showPlaceholder ? "text-text-dim" : "text-white"}`}
        >
          {display}
        </span>
        <FontAwesomeIcon
          icon={faChevronDown}
          className={`shrink-0 text-xs text-text-muted transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-labelledby={id}
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-surface py-1 shadow-2xl"
        >
          {options.map((opt) => (
            <li key={opt.value || "__empty__"}>
              <button
                type="button"
                role="option"
                aria-selected={opt.value === value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-white/5 ${
                  opt.value === value ? "text-accent" : "text-white"
                }`}
              >
                {opt.value === value ? (
                  <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                ) : (
                  <span className="inline-block h-1.5 w-1.5 shrink-0" />
                )}
                <span className="truncate">{opt.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
