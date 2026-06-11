import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons";
import { useTranslationMessages } from "../contexts/I18nContext";
import type { SkillManualItem } from "../services/skills";
import { SkillManualDetailModal } from "./SkillManualDetailModal";

interface SkillManualSectionProps {
  title: string;
  items: SkillManualItem[];
  selectedId: string;
  loading?: boolean;
  onSelect: (id: string) => void;
  variant: "visual" | "director";
  /** When true, section sizes to content instead of filling remaining height. */
  compact?: boolean;
}

export function SkillManualSection({
  title,
  items,
  selectedId,
  loading = false,
  onSelect,
  variant,
  compact = false,
}: SkillManualSectionProps) {
  const i18n = useTranslationMessages();
  const viewDetailLabel = i18n.creation.skillDetail.viewDetail;
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !selectedId) return;

    const frame = requestAnimationFrame(() => {
      const container = scrollRef.current;
      const selected = selectedRef.current;
      if (!container || !selected) return;

      const containerRect = container.getBoundingClientRect();
      const selectedRect = selected.getBoundingClientRect();
      const padding = 8;

      if (selectedRect.top < containerRect.top) {
        container.scrollTo({
          top: container.scrollTop - (containerRect.top - selectedRect.top + padding),
          behavior: "smooth",
        });
      } else if (selectedRect.bottom > containerRect.bottom) {
        container.scrollTo({
          top: container.scrollTop + (selectedRect.bottom - containerRect.bottom + padding),
          behavior: "smooth",
        });
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [selectedId, loading, items]);

  return (
    <>
      <div
        className={`flex flex-col space-y-3 ${compact ? "shrink-0" : "min-h-0 flex-1"}`}
      >
        <span className="text-sm font-medium text-white">{title}</span>

        <div
          ref={scrollRef}
          className={`pr-1 ${compact ? "max-h-[220px] overflow-y-auto" : "min-h-0 flex-1 overflow-y-auto"}`}
        >
          {loading ? (
            <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-white/10 bg-surface/40 text-xs text-text-dim">
              …
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-white/10 bg-surface/40 text-xs text-text-dim">
              —
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {items.map((item) => {
                const selected = item.id === selectedId;
                return (
                  <div
                    key={item.id}
                    ref={selected ? selectedRef : undefined}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(item.id);
                      }
                    }}
                    className={`group relative cursor-pointer overflow-hidden rounded-lg border text-left transition outline-none focus-visible:ring-1 focus-visible:ring-accent/50 ${
                      selected
                        ? "border-accent"
                        : "border-white/10 hover:border-white/20"
                    }`}
                  >
                    <button
                      type="button"
                      aria-label={viewDetailLabel}
                      title={viewDetailLabel}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailId(item.id);
                      }}
                      className="absolute right-1.5 top-1.5 z-20 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-black/65 text-[10px] text-white/90 opacity-0 backdrop-blur-sm transition hover:bg-black/85 hover:text-accent group-hover:opacity-100"
                    >
                      <FontAwesomeIcon icon={faCircleInfo} />
                    </button>

                    <div className="relative aspect-[4/3] bg-surface">
                      {item.coverUrl ? (
                        <img
                          src={item.coverUrl}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-surface-elevated px-2 text-center text-[10px] text-text-dim">
                          {item.name}
                        </div>
                      )}
                      {!selected && (
                        <div className="absolute inset-0 bg-black/35 transition" />
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-2 pb-2 pt-6">
                        <p className="line-clamp-2 text-[10px] leading-snug text-white">
                          # {item.name}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <SkillManualDetailModal
        open={detailId !== null}
        skillId={detailId}
        variant={variant}
        onClose={() => setDetailId(null)}
      />
    </>
  );
}
