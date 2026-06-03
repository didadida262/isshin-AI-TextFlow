use crate::db::init_db;
use regex::Regex;
use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};
use std::sync::LazyLock;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NovelChapterRecord {
    pub id: i64,
    pub project_id: String,
    pub chapter_index: i32,
    pub reel: String,
    pub chapter: String,
    pub chapter_data: String,
    pub event_state: i32,
    pub event: Option<String>,
    pub error_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NovelSourceRecord {
    pub project_id: String,
    pub source_text: String,
    pub char_count: i32,
    pub imported_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportNovelResult {
    pub chapter_count: i32,
    pub char_count: i32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateChapterEventInput {
    pub id: i64,
    pub event: Option<String>,
    pub error_reason: Option<String>,
    pub event_state: i32,
}

pub(crate) struct ParsedChapter {
    index: i32,
    reel: String,
    title: String,
    content: String,
}

static CHAPTER_UNIT: &str = r"[章回节话]";

static CHAPTER_HEADING: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(&format!(
        r"(?m)^第\s*[0-9一二三四五六七八九十百千万零]+\s*{CHAPTER_UNIT}[^\n\r]*"
    ))
    .expect("chapter regex")
});

static REEL_HEADING: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"第\s*[0-9一二三四五六七八九十百千万零]+\s*[卷部篇][^\n\r]*").expect("reel regex")
});

static CHAPTER_PREFIX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(&format!(
        r"^第\s*[0-9一二三四五六七八九十百千万零]+\s*{CHAPTER_UNIT}\s*"
    ))
    .expect("chapter prefix regex")
});

static CHAPTER_HEADER_LINE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(&format!(
        r"^第\s*[0-9一二三四五六七八九十百千万零]+\s*{CHAPTER_UNIT}\s*$"
    ))
    .expect("chapter header line regex")
});

static CHAPTER_NUM_TOKEN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(&format!(
        r"第\s*([0-9一二三四五六七八九十百千万零]+)\s*{CHAPTER_UNIT}"
    ))
    .expect("chapter num token regex")
});

pub fn init_schema(conn: &Connection) -> Result<(), String> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS novel_source (
            project_id TEXT PRIMARY KEY,
            source_text TEXT NOT NULL,
            char_count INTEGER NOT NULL,
            imported_at INTEGER NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )",
        [],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS novel_chapters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL,
            chapter_index INTEGER NOT NULL,
            reel TEXT NOT NULL,
            chapter TEXT NOT NULL,
            chapter_data TEXT NOT NULL,
            event_state INTEGER NOT NULL DEFAULT 0,
            event TEXT,
            error_reason TEXT,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            UNIQUE (project_id, chapter_index)
        )",
        [],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_novel_chapters_project
         ON novel_chapters(project_id, chapter_index)",
        [],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub fn clear_project_novel_data(conn: &Connection, project_id: &str) -> Result<(), String> {
    conn.execute(
        "DELETE FROM novel_chapters WHERE project_id = ?1",
        params![project_id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM novel_source WHERE project_id = ?1",
        params![project_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn parse_chapter_title(heading: &str) -> String {
    let trimmed = heading.trim();
    CHAPTER_PREFIX
        .replace(trimmed, "")
        .trim()
        .to_string()
        .if_empty_then(|| trimmed.to_string())
}

fn chapter_num_token(heading: &str) -> Option<String> {
    CHAPTER_NUM_TOKEN
        .captures(heading.trim())
        .and_then(|caps| caps.get(1))
        .map(|m| m.as_str().replace(' ', ""))
}

fn dedupe_chapter_boundaries<'a>(matches: Vec<regex::Match<'a>>) -> Vec<regex::Match<'a>> {
    let mut seen_tokens = std::collections::HashSet::new();
    let mut deduped = Vec::with_capacity(matches.len());

    for mat in matches {
        match chapter_num_token(mat.as_str()) {
            Some(token) if seen_tokens.contains(&token) => continue,
            Some(token) => {
                seen_tokens.insert(token);
                deduped.push(mat);
            }
            None => deduped.push(mat),
        }
    }

    deduped
}

fn strip_leading_duplicate_headers(content: &str, title: &str) -> String {
    let title = title.trim();
    let mut remaining = content.trim_start();

    loop {
        if remaining.is_empty() {
            return String::new();
        }

        let Some((line, rest)) = remaining.split_once('\n') else {
            let trimmed = remaining.trim();
            if trimmed.is_empty() {
                return String::new();
            }
            if CHAPTER_HEADER_LINE.is_match(trimmed) {
                return String::new();
            }
            if !title.is_empty() && trimmed == title {
                return String::new();
            }
            return remaining.to_string();
        };

        let trimmed = line.trim();
        if trimmed.is_empty()
            || CHAPTER_HEADER_LINE.is_match(trimmed)
            || (!title.is_empty() && trimmed == title)
        {
            remaining = rest.trim_start();
            continue;
        }

        return format!("{trimmed}\n{rest}").trim_end().to_string();
    }
}

trait IfEmptyThen {
    fn if_empty_then<F: FnOnce() -> String>(self, f: F) -> String;
}

impl IfEmptyThen for String {
    fn if_empty_then<F: FnOnce() -> String>(self, f: F) -> String {
        if self.is_empty() {
            f()
        } else {
            self
        }
    }
}

fn detect_reel(text: &str, before_index: usize) -> String {
    let prefix = &text[..before_index.min(text.len())];
    let mut last: Option<&str> = None;
    for mat in REEL_HEADING.find_iter(prefix) {
        last = Some(mat.as_str());
    }
    last.map(|s| s.trim().to_string())
        .unwrap_or_else(|| "正文卷".to_string())
}

pub fn split_novel_chapters(text: &str) -> Vec<ParsedChapter> {
    let normalized = text.replace("\r\n", "\n").trim().to_string();
    if normalized.is_empty() {
        return vec![];
    }

    let raw_matches: Vec<_> = CHAPTER_HEADING.find_iter(&normalized).collect();
    if raw_matches.is_empty() {
        return vec![ParsedChapter {
            index: 1,
            reel: detect_reel(&normalized, 0),
            title: "第一章".to_string(),
            content: normalized,
        }];
    }

    let matches = dedupe_chapter_boundaries(raw_matches);
    let mut chapters = Vec::with_capacity(matches.len());
    for (i, mat) in matches.iter().enumerate() {
        let start = mat.start();
        let heading = mat.as_str();
        let body_start = mat.end();
        let body_end = matches
            .get(i + 1)
            .map(|next| next.start())
            .unwrap_or(normalized.len());
        let raw_content = normalized[body_start..body_end].trim();
        let title = parse_chapter_title(heading);
        let resolved_title = if title.is_empty() {
            heading.trim().to_string()
        } else {
            title
        };
        let content = if raw_content.is_empty() {
            resolved_title.clone()
        } else {
            strip_leading_duplicate_headers(raw_content, &resolved_title)
        };

        chapters.push(ParsedChapter {
            index: (i + 1) as i32,
            reel: detect_reel(&normalized, start),
            title: resolved_title,
            content,
        });
    }

    chapters
}

fn row_to_chapter(row: &Row<'_>) -> rusqlite::Result<NovelChapterRecord> {
    Ok(NovelChapterRecord {
        id: row.get(0)?,
        project_id: row.get(1)?,
        chapter_index: row.get(2)?,
        reel: row.get(3)?,
        chapter: row.get(4)?,
        chapter_data: row.get(5)?,
        event_state: row.get(6)?,
        event: row.get(7)?,
        error_reason: row.get(8)?,
    })
}

const CHAPTER_SELECT: &str = "SELECT id, project_id, chapter_index, reel, chapter, chapter_data, event_state, event, error_reason";

pub(crate) fn fetch_novel_source(
    conn: &Connection,
    project_id: &str,
) -> Result<Option<NovelSourceRecord>, String> {
    let result = conn.query_row(
        "SELECT project_id, source_text, char_count, imported_at
         FROM novel_source WHERE project_id = ?1",
        params![project_id],
        |row| {
            Ok(NovelSourceRecord {
                project_id: row.get(0)?,
                source_text: row.get(1)?,
                char_count: row.get(2)?,
                imported_at: row.get(3)?,
            })
        },
    );

    match result {
        Ok(record) => Ok(Some(record)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub(crate) fn fetch_novel_chapters(
    conn: &Connection,
    project_id: &str,
) -> Result<Vec<NovelChapterRecord>, String> {
    let mut stmt = conn
        .prepare(&format!(
            "{CHAPTER_SELECT} FROM novel_chapters
             WHERE project_id = ?1 ORDER BY chapter_index ASC"
        ))
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![project_id], row_to_chapter)
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub(crate) fn is_extract_events_completed(chapters: &[NovelChapterRecord]) -> bool {
    !chapters.is_empty() && chapters.iter().all(|chapter| chapter.event_state == 1)
}

fn ensure_project_exists(conn: &Connection, project_id: &str) -> Result<(), String> {
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM projects WHERE id = ?1",
            params![project_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if count == 0 {
        return Err(format!("项目不存在: {project_id}"));
    }
    Ok(())
}

#[tauri::command]
pub fn import_novel(project_id: String, source_text: String) -> Result<ImportNovelResult, String> {
    let conn = init_db()?;
    ensure_project_exists(&conn, &project_id)?;

    let normalized = source_text.trim().to_string();
    if normalized.is_empty() {
        return Err("原文不能为空".to_string());
    }

    let chapters = split_novel_chapters(&normalized);
    if chapters.is_empty() {
        return Err("未能解析出章节内容".to_string());
    }

    let char_count = normalized.chars().count() as i32;
    let imported_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as i64;

    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "DELETE FROM novel_chapters WHERE project_id = ?1",
        params![project_id],
    )
    .map_err(|e| e.to_string())?;

    crate::script::clear_project_script_data(&tx, &project_id)?;

    tx.execute(
        "INSERT INTO novel_source (project_id, source_text, char_count, imported_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(project_id) DO UPDATE SET
            source_text = excluded.source_text,
            char_count = excluded.char_count,
            imported_at = excluded.imported_at",
        params![project_id, normalized, char_count, imported_at],
    )
    .map_err(|e| e.to_string())?;

    for chapter in &chapters {
        tx.execute(
            "INSERT INTO novel_chapters (
                project_id, chapter_index, reel, chapter, chapter_data,
                event_state, event, error_reason, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, 0, NULL, NULL, ?6)",
            params![
                project_id,
                chapter.index,
                chapter.reel,
                chapter.title,
                chapter.content,
                imported_at,
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;

    crate::workflow::reset_to_extract_events(&conn, &project_id)?;

    Ok(ImportNovelResult {
        chapter_count: chapters.len() as i32,
        char_count,
    })
}

#[tauri::command]
pub fn get_novel_source(project_id: String) -> Result<Option<NovelSourceRecord>, String> {
    let conn = init_db()?;
    fetch_novel_source(&conn, &project_id)
}

#[tauri::command]
pub fn list_novel_chapters(project_id: String) -> Result<Vec<NovelChapterRecord>, String> {
    let conn = init_db()?;
    fetch_novel_chapters(&conn, &project_id)
}

#[tauri::command]
pub fn update_novel_chapter_event(input: UpdateChapterEventInput) -> Result<(), String> {
    let conn = init_db()?;
    let affected = conn
        .execute(
            "UPDATE novel_chapters SET
                event = ?2,
                error_reason = ?3,
                event_state = ?4
             WHERE id = ?1",
            params![
                input.id,
                input.event,
                input.error_reason,
                input.event_state,
            ],
        )
        .map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err(format!("章节不存在: {}", input.id));
    }

    let project_id: String = conn
        .query_row(
            "SELECT project_id FROM novel_chapters WHERE id = ?1",
            params![input.id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    crate::workflow::maybe_advance_after_extract(&conn, &project_id)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_multiple_chapters() {
        let text = "第一章 开端\n内容1\n第二章 发展\n内容2";
        let chapters = split_novel_chapters(text);
        assert_eq!(chapters.len(), 2);
        assert_eq!(chapters[0].index, 1);
        assert_eq!(chapters[0].title, "开端");
        assert_eq!(chapters[1].index, 2);
    }

    #[test]
    fn splits_hui_with_duplicate_headers() {
        let text = "第一回王教头私走延安府九纹龙大闹史家村\n第一回\n王教头私走延安府九纹龙大闹史家村\n诗曰：\n正文内容\n第二回史大郎私走华州府\n第二回\n史大郎私走华州府\n却说\n第二回正文";
        let chapters = split_novel_chapters(text);
        assert_eq!(chapters.len(), 2);
        assert_eq!(
            chapters[0].title,
            "王教头私走延安府九纹龙大闹史家村"
        );
        assert!(chapters[0].content.starts_with("诗曰："));
        assert!(!chapters[0].content.contains("第一回\n"));
        assert_eq!(chapters[1].title, "史大郎私走华州府");
        assert!(chapters[1].content.contains("第二回正文"));
    }

    #[test]
    fn dedupes_repeated_hui_marker_within_same_chapter() {
        let text = "第一回标题合并行\n第一回\n标题合并行\n正文";
        let chapters = split_novel_chapters(text);
        assert_eq!(chapters.len(), 1);
        assert_eq!(chapters[0].title, "标题合并行");
        assert_eq!(chapters[0].content, "正文");
    }
}
