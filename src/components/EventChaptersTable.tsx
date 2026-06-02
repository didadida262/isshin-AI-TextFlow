import { useTranslationMessages } from "../contexts/I18nContext";
import type { NovelChapterRecord } from "../services/novel";
import { HoverFullText } from "./HoverFullText";

interface EventChaptersTableProps {
  chapters: NovelChapterRecord[];
  showContentColumn?: boolean;
}

export function EventChaptersTable({
  chapters,
  showContentColumn = true,
}: EventChaptersTableProps) {
  const s = useTranslationMessages().creation.extractEventsStep;
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
                  className="border-b border-white/5 align-top last:border-0"
                >
                  <td className="px-4 py-3 text-text-muted">{row.chapterIndex}</td>
                  <td className="px-4 py-3 text-text-muted">{row.reel}</td>
                  <td className="px-4 py-3 text-white">{row.chapter}</td>
                  {showContentColumn ? (
                    <td className="max-w-0 overflow-hidden px-4 py-3 text-text-muted">
                      <HoverFullText
                        text={row.chapterData}
                        className="text-text-muted"
                        lines={2}
                      />
                    </td>
                  ) : null}
                  <td className="max-w-0 overflow-hidden px-4 py-3">
                    {row.errorReason ? (
                      <HoverFullText
                        text={row.errorReason}
                        className="text-red-400"
                        lines={2}
                      />
                    ) : (
                      <HoverFullText
                        text={row.event || s.noEvent}
                        className="text-white"
                        lines={2}
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
  );
}
