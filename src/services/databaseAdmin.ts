import { invoke, isTauri } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

export interface TableOverview {
  name: string;
  rowCount: number;
}

export interface DatabaseOverview {
  dbPath: string;
  tables: TableOverview[];
}

export interface DatabaseImportResult {
  importedTables: string[];
  totalRows: number;
}

export async function getDatabaseOverview(): Promise<DatabaseOverview> {
  return invoke<DatabaseOverview>("get_database_overview");
}

export async function exportDatabase(): Promise<string> {
  return invoke<string>("export_database");
}

export async function exportDatabaseToChosenPath(options?: {
  dialogTitle?: string;
}): Promise<string | null> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const defaultName = `isshin-textflow-backup-${timestamp}.json`;

  if (!isTauri()) {
    const payload = await exportDatabase();
    downloadJsonFile(defaultName, payload);
    return defaultName;
  }

  const path = await save({
    title: options?.dialogTitle,
    defaultPath: defaultName,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });

  if (!path) {
    return null;
  }

  await invoke("export_database_to_file", { path });
  return path;
}

export async function importDatabase(payload: string): Promise<DatabaseImportResult> {
  return invoke<DatabaseImportResult>("import_database", { payload });
}

export async function clearDatabaseTable(tableName: string): Promise<number> {
  return invoke<number>("clear_database_table", { tableName });
}

export async function clearDatabase(): Promise<number> {
  return invoke<number>("clear_database");
}

export function downloadJsonFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
