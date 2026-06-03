import { useState } from "react";
import { useTranslationMessages } from "../contexts/I18nContext";
import type { NovelChapterRecord } from "../services/novel";
import { EventChapterDetailModal } from "./EventChapterDetailModal";

interface EventChaptersTableProps {
  chapters: NovelChapterRecord[];
  showContentColumn?: boolean;
}

function CellText({
  text,
  className = "",
  lines = 2,
}: {
  text: string;
  className?: string;
  lines?: 1 | 2;
}) {
  const display = text.replace(/\s+/g, " ").trim() || "—";
  const clampClass = lines === 1 ? "truncate" : "text-clamp-2";

  return (
    <div className={`min-w-0 leading-relaxed ${clampClass} ${className}`}>
      {display}
    </div>
  );
}

export function EventChaptersTable({
  chapters,
  showContentColumn = true,
}: EventChaptersTableProps) {
  const s = useTranslationMessages().creation.extractEventsStep;
  const [selectedChapter, setSelectedChapter] = useState<NovelChapterRecord | null>(
    null,
  );
  const minWidth = showContentColumn ? "min-w-[720px]" : "min-w-[480px]";

  const colgroup = showContentColumn ? (
    <colgroup>
      <col className="w-14" />
      <col className="w-24" />
      <col className="w-28" />
      <col className="w-[280px]" />
      <col />
    </colgroup>
  ) : (
    <colgroup>
      <col className="w-14" />
      <col className="w-24" />
      <col className="w-28" />
      <col />
    </colgroup>
  );

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-surface/20">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 overflow-x-auto border-b border-white/10">
            <table className={`w-full table-fixed text-left text-sm ${minWidth}`}>
              {colgroup}
              <thead>
                <tr className="text-xs text-text-muted">
                  <th className="px-4 py-3 font-medium">{s.colIndex}</th>
                  <th className="px-4 py-3 font-medium">{s.colReel}</th>
                  <th className="px-4 py-3 font-medium">{s.colChapter}</th>
                  {showContentColumn ? (
                    <th className="px-4 py-3 font-medium">{s.colContent}</th>
                  ) : null}
                  <th className="px-4 py-3 font-medium">{s.colEvent}</th>
                </tr>
              </thead>
            </table>
          </div>
          <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
            <table className={`w-full table-fixed text-left text-sm ${minWidth}`}>
              {colgroup}
              <tbody>
                {chapters.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-b border-white/5 align-top transition hover:bg-white/[0.03] last:border-0"
                    onClick={() => setSelectedChapter(row)}
                  >
                    <td className="px-4 py-3 text-text-muted">{row.chapterIndex}</td>
                    <td className="px-4 py-3 text-text-muted">{row.reel}</td>
                    <td className="px-4 py-3 text-white">{row.chapter}</td>
                    {showContentColumn ? (
                      <td className="max-w-0 overflow-hidden px-4 py-3 text-text-muted">
                        <CellText text={row.chapterData} className="text-text-muted" />
                      </td>
                    ) : null}
                    <td className="max-w-0 overflow-hidden px-4 py-3">
                      {row.errorReason ? (
                        <CellText text={row.errorReason} className="text-red-400" />
                      ) : (
                        <CellText
                          text={row.event || s.noEvent}
                          className="text-white"
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <EventChapterDetailModal
        chapter={selectedChapter}
        onClose={() => setSelectedChapter(null)}
      />
    </>
  );
}
