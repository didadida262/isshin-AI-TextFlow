import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDatabase,
  faFileArrowDown,
  faFileArrowUp,
  faListUl,
  faSpinner,
  faTrashCan,
} from "@fortawesome/free-solid-svg-icons";
import { useI18n, useTranslationMessages } from "../../contexts/I18nContext";
import {
  clearDatabase,
  clearDatabaseTable,
  exportDatabaseToChosenPath,
  getDatabaseOverview,
  importDatabase,
  type DatabaseOverview,
} from "../../services/databaseAdmin";
import { Select } from "../Select";
import { DatabaseOverviewModal } from "./DatabaseOverviewModal";

type ConfirmKind = "import" | "clearTable" | "clearAll";

interface DatabaseActionRowProps {
  title: string;
  description: string;
  actionLabel: string;
  loadingLabel: string;
  loading?: boolean;
  tone?: "default" | "warning" | "danger";
  icon: typeof faListUl;
  onAction: () => void;
  trailing?: ReactNode;
}

function DatabaseActionRow({
  title,
  description,
  actionLabel,
  loadingLabel,
  loading = false,
  tone = "default",
  icon,
  onAction,
  trailing,
}: DatabaseActionRowProps) {
  const buttonClass =
    tone === "danger"
      ? "border-red-500/30 text-red-300 hover:bg-red-500/10"
      : tone === "warning"
        ? "border-accent/30 text-accent hover:bg-accent/10"
        : "border-white/10 text-text-muted hover:bg-white/5 hover:text-white";

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-surface/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-text-muted">{description}</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {trailing}
        <button
          type="button"
          onClick={onAction}
          disabled={loading}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${buttonClass}`}
        >
          {loading ? (
            <FontAwesomeIcon icon={faSpinner} spin className="text-xs" />
          ) : (
            <FontAwesomeIcon icon={icon} className="text-xs" />
          )}
          {loading ? loadingLabel : actionLabel}
        </button>
      </div>
    </div>
  );
}

export function DatabaseOperationsPanel() {
  const { t } = useI18n();
  const db = useTranslationMessages().settings.database;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [overview, setOverview] = useState<DatabaseOverview | null>(null);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [tableNames, setTableNames] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState("");
  const [pendingImport, setPendingImport] = useState("");
  const [confirmKind, setConfirmKind] = useState<ConfirmKind | null>(null);
  const [busy, setBusy] = useState<
    "overview" | "export" | "import" | "clearTable" | "clearAll" | null
  >(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refreshTables = useCallback(async () => {
    const nextOverview = await getDatabaseOverview();
    setOverview(nextOverview);
    setTableNames(nextOverview.tables.map((table) => table.name));
    setSelectedTable((current) => current || nextOverview.tables[0]?.name || "");
  }, []);

  useEffect(() => {
    void refreshTables().catch((refreshError) => {
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
    });
  }, [refreshTables]);

  const tableOptions = useMemo(
    () => tableNames.map((name) => ({ value: name, label: name })),
    [tableNames],
  );

  const handleViewOverview = async () => {
    setError("");
    setMessage("");
    setBusy("overview");
    try {
      const nextOverview = await getDatabaseOverview();
      setOverview(nextOverview);
      setOverviewOpen(true);
    } catch (viewError) {
      setError(viewError instanceof Error ? viewError.message : String(viewError));
    } finally {
      setBusy(null);
    }
  };

  const handleExport = async () => {
    setError("");
    setMessage("");
    setBusy("export");
    try {
      const savedPath = await exportDatabaseToChosenPath({
        dialogTitle: db.exportDialogTitle,
      });
      if (!savedPath) return;
      setMessage(t("settings.database.exportSuccessTo", { path: savedPath }));
      await refreshTables();
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : String(exportError));
    } finally {
      setBusy(null);
    }
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      setPendingImport(text);
      setConfirmKind("import");
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : String(readError));
    }
  };

  const runImport = async () => {
    setBusy("import");
    setError("");
    setMessage("");
    try {
      const result = await importDatabase(pendingImport);
      setMessage(t("settings.database.importSuccess", { count: result.totalRows }));
      setConfirmKind(null);
      setPendingImport("");
      await refreshTables();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : String(importError));
    } finally {
      setBusy(null);
    }
  };

  const runClearTable = async () => {
    if (!selectedTable) return;
    setBusy("clearTable");
    setError("");
    setMessage("");
    try {
      const deleted = await clearDatabaseTable(selectedTable);
      setMessage(
        t("settings.database.clearTableSuccess", {
          table: selectedTable,
          count: deleted,
        }),
      );
      setConfirmKind(null);
      await refreshTables();
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : String(clearError));
    } finally {
      setBusy(null);
    }
  };

  const runClearAll = async () => {
    setBusy("clearAll");
    setError("");
    setMessage("");
    try {
      const deleted = await clearDatabase();
      setMessage(t("settings.database.clearAllSuccess", { count: deleted }));
      setConfirmKind(null);
      await refreshTables();
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : String(clearError));
    } finally {
      setBusy(null);
    }
  };

  const confirmTitle =
    confirmKind === "import"
      ? db.confirmImportTitle
      : confirmKind === "clearTable"
        ? db.confirmClearTableTitle
        : confirmKind === "clearAll"
          ? db.confirmClearAllTitle
          : "";

  const confirmBody =
    confirmKind === "import"
      ? db.confirmImportBody
      : confirmKind === "clearTable"
        ? t("settings.database.confirmClearTableBody", { table: selectedTable })
        : confirmKind === "clearAll"
          ? db.confirmClearAllBody
          : "";

  const confirmLoading =
    busy === "import" || busy === "clearTable" || busy === "clearAll";

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-white">{db.title}</h3>

      <DatabaseActionRow
        title={db.overviewTitle}
        description={db.overviewDesc}
        actionLabel={db.overviewAction}
        loadingLabel={db.exporting}
        loading={busy === "overview"}
        icon={faListUl}
        onAction={() => void handleViewOverview()}
      />

      <DatabaseActionRow
        title={db.exportTitle}
        description={db.exportDesc}
        actionLabel={db.exportAction}
        loadingLabel={db.exporting}
        loading={busy === "export"}
        icon={faFileArrowUp}
        onAction={() => void handleExport()}
      />

      <DatabaseActionRow
        title={db.importTitle}
        description={db.importDesc}
        actionLabel={db.importAction}
        loadingLabel={db.importing}
        loading={busy === "import"}
        tone="warning"
        icon={faFileArrowDown}
        onAction={() => fileInputRef.current?.click()}
      />

      <DatabaseActionRow
        title={db.clearTableTitle}
        description={db.clearTableDesc}
        actionLabel={db.clearTableAction}
        loadingLabel={db.clearing}
        loading={busy === "clearTable"}
        tone="warning"
        icon={faTrashCan}
        onAction={() => {
          if (!selectedTable) return;
          setConfirmKind("clearTable");
        }}
        trailing={
          <div className="w-44">
            <Select
              value={selectedTable}
              options={tableOptions}
              onChange={setSelectedTable}
              disabled={busy === "clearTable" || tableOptions.length === 0}
              placeholder={db.clearTableSelect}
            />
          </div>
        }
      />

      <DatabaseActionRow
        title={db.clearAllTitle}
        description={db.clearAllDesc}
        actionLabel={db.clearAllAction}
        loadingLabel={db.clearing}
        loading={busy === "clearAll"}
        tone="danger"
        icon={faDatabase}
        onAction={() => setConfirmKind("clearAll")}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => void handleImportFile(event)}
      />

      {message ? (
        <p className="rounded-lg border border-accent/20 bg-accent/10 px-3 py-2 text-xs text-accent">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      ) : null}

      <DatabaseOverviewModal
        overview={overviewOpen ? overview : null}
        onClose={() => setOverviewOpen(false)}
      />

      {confirmKind ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label={db.cancel}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={confirmLoading ? undefined : () => setConfirmKind(null)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#121212] p-5 shadow-2xl">
            <h4 className="text-base font-semibold text-white">{confirmTitle}</h4>
            <p className="mt-2 text-sm leading-relaxed text-text-muted">{confirmBody}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={confirmLoading}
                onClick={() => setConfirmKind(null)}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-text-muted transition hover:bg-white/5 hover:text-white disabled:opacity-40"
              >
                {db.cancel}
              </button>
              <button
                type="button"
                disabled={confirmLoading}
                onClick={() => {
                  if (confirmKind === "import") void runImport();
                  if (confirmKind === "clearTable") void runClearTable();
                  if (confirmKind === "clearAll") void runClearAll();
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-red-500/90 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500 disabled:opacity-40"
              >
                {confirmLoading ? (
                  <FontAwesomeIcon icon={faSpinner} spin className="text-xs" />
                ) : null}
                {db.confirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
