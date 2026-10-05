//! The engine-independent half of `sample` and `import`.

use std::collections::HashSet;

use crate::delimited::DelimitedReader;
use crate::error::{DatabaseError, Result};
use crate::protocol::{ImportParams, SampleParams, SampleResult, TableStructure};
use crate::quoting::Dialect;
use crate::sql::MAX_LIMIT;

const DEFAULT_SAMPLE_LIMIT: i64 = 20;
const MAX_ROWS_PER_INSERT: usize = 1000;
const MAX_PARAMS_PER_INSERT: usize = 8000;

/// The first lines of a file, as text, for a form that maps its columns.
pub fn sample(params: &SampleParams) -> Result<SampleResult> {
    let limit = match params.limit {
        None => DEFAULT_SAMPLE_LIMIT,
        Some(limit) if (1..=MAX_LIMIT).contains(&limit) => limit,
        Some(_) => return Err(DatabaseError::invalid_request(format!("The limit must be between 1 and {MAX_LIMIT}."))),
    };
    let mut reader = DelimitedReader::open(&params.path, params.format)?;
    let mut columns = Vec::new();

    if params.header
        && let Some(header) = reader.next_line()?
    {
        columns = header
            .fields
            .iter()
            .map(|field| reader.value_of(field).unwrap_or_else(|| field.clone()))
            .collect();
    }

    let mut rows: Vec<Vec<String>> = Vec::new();

    while rows.len() < limit as usize {
        let Some(line) = reader.next_line()? else {
            break;
        };

        rows.push(
            line.fields
                .iter()
                .map(|field| reader.value_of(field).unwrap_or_else(|| field.clone()))
                .collect(),
        );
    }

    let width = rows.iter().map(Vec::len).max().unwrap_or(0).max(columns.len());

    for index in columns.len()..width {
        columns.push(format!("column{}", index + 1));
    }

    for row in &mut rows {
        row.resize(width, String::new());
    }

    Ok(SampleResult { columns, rows })
}

/// A line of the file reduced to the mapped fields, in the order of `ImportPlan::names`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImportRow {
    pub line: u64,
    pub values: Vec<Option<String>>,
}

/// Which fields of a line go into which column.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ImportPlan {
    /// The number of fields every line must have.
    pub fields: usize,
    /// The target columns, with the position of the field that fills each.
    pub mapped: Vec<(usize, String)>,
}

impl ImportPlan {
    pub fn new(columns: &[Option<String>], structure: &TableStructure) -> Result<ImportPlan> {
        let mut seen = HashSet::new();
        let mut mapped = Vec::new();

        for (position, column) in columns.iter().enumerate() {
            let Some(name) = column else {
                continue;
            };

            let Some(info) = structure.columns.iter().find(|candidate| &candidate.name == name) else {
                return Err(DatabaseError::invalid_request(format!("The table has no column \"{name}\".")));
            };

            if info.generated {
                return Err(DatabaseError::invalid_request(format!("Column \"{name}\" is generated and cannot be written.")));
            }

            if !seen.insert(name.clone()) {
                return Err(DatabaseError::invalid_request(format!("Column \"{name}\" is mapped more than once.")));
            }

            mapped.push((position, name.clone()));
        }

        if mapped.is_empty() {
            return Err(DatabaseError::invalid_request("An import needs at least one mapped column."));
        }

        Ok(ImportPlan { fields: columns.len(), mapped })
    }

    pub fn names(&self) -> Vec<String> {
        self.mapped.iter().map(|(_, name)| name.clone()).collect()
    }

    /// Rows per INSERT, so one statement stays below the placeholder limits of both engines.
    pub fn rows_per_insert(&self) -> usize {
        (MAX_PARAMS_PER_INSERT / self.mapped.len()).clamp(1, MAX_ROWS_PER_INSERT)
    }
}

/// Reads the lines of an import file in batches.
pub struct ImportReader {
    reader: DelimitedReader,
    plan: ImportPlan,
}

impl ImportReader {
    pub fn open(params: &ImportParams, plan: ImportPlan) -> Result<ImportReader> {
        let mut reader = DelimitedReader::open(&params.path, params.format)?;

        if params.header {
            reader.next_line()?;
        }

        Ok(ImportReader { reader, plan })
    }

    pub fn next_batch(&mut self) -> Result<Vec<ImportRow>> {
        let size = self.plan.rows_per_insert();
        let mut batch = Vec::with_capacity(size);

        while batch.len() < size {
            let Some(line) = self.reader.next_line()? else {
                break;
            };

            if line.fields.len() != self.plan.fields {
                return Err(DatabaseError::file_failed(format!(
                    "Line {} has {} fields, but the mapping has {}.",
                    line.number,
                    line.fields.len(),
                    self.plan.fields
                )));
            }

            batch.push(ImportRow {
                line: line.number,
                values: self
                    .plan
                    .mapped
                    .iter()
                    .map(|(position, _)| self.reader.value_of(&line.fields[*position]))
                    .collect(),
            });
        }

        Ok(batch)
    }
}

/// `INSERT INTO t (a, b) VALUES (?, ?), (?, ?)` for `rows` rows.
pub fn insert_sql(dialect: Dialect, schema: &str, table: &str, names: &[String], rows: usize) -> String {
    let columns: Vec<String> = names.iter().map(|name| dialect.quote_ident(name)).collect();
    let group = format!("({})", vec!["?"; names.len()].join(", "));
    let groups = vec![group; rows].join(", ");

    format!("INSERT INTO {} ({}) VALUES {groups}", dialect.qualified(schema, table), columns.join(", "))
}

/// Puts the line in front of what the server said, keeping its SQLSTATE.
pub fn at_line(mut error: DatabaseError, line: u64) -> DatabaseError {
    error.message = format!("Line {line}: {}", error.message);

    error
}

/// A batch failed as a whole: the lines it spans, for an error no single line caused.
pub fn at_lines(mut error: DatabaseError, batch: &[ImportRow]) -> DatabaseError {
    if let (Some(first), Some(last)) = (batch.first(), batch.last()) {
        error.message = format!("Lines {} to {}: {}", first.line, last.line, error.message);
    }

    error
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::{ColumnInfo, DelimitedFormat, TableKind, ValueKind};

    fn structure() -> TableStructure {
        let column = |name: &str, generated: bool| ColumnInfo {
            name: name.to_string(),
            column_type: "text".to_string(),
            kind: ValueKind::Text,
            nullable: true,
            default_value: None,
            auto_increment: false,
            generated,
            comment: None,
        };

        TableStructure {
            schema: "main".to_string(),
            name: "users".to_string(),
            kind: TableKind::Table,
            columns: vec![column("id", false), column("email", false), column("created_at", false), column("total", true)],
            primary_key: vec![],
            row_key: None,
            indexes: vec![],
            foreign_keys: vec![],
            ddl: None,
        }
    }

    fn mapping(names: &[Option<&str>]) -> Vec<Option<String>> {
        names.iter().map(|name| name.map(String::from)).collect()
    }

    fn file(content: &str) -> (tempfile::TempDir, String) {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("data.csv");
        std::fs::write(&path, content).unwrap();
        let path = path.to_str().unwrap().to_string();

        (directory, path)
    }

    fn import(path: &str, header: bool, columns: Vec<Option<String>>) -> ImportParams {
        ImportParams {
            session: "s1".to_string(),
            schema: "main".to_string(),
            table: "users".to_string(),
            path: path.to_string(),
            format: DelimitedFormat::Csv,
            header,
            columns,
        }
    }

    #[test]
    fn plans_the_mapped_columns() {
        let plan = ImportPlan::new(&mapping(&[None, Some("email"), Some("created_at")]), &structure()).unwrap();

        assert_eq!(plan.fields, 3);
        assert_eq!(plan.mapped, vec![(1, "email".to_string()), (2, "created_at".to_string())]);
        assert_eq!(plan.names(), ["email", "created_at"]);
    }

    #[test]
    fn refuses_a_bad_mapping() {
        assert!(ImportPlan::new(&mapping(&[None, None]), &structure()).is_err());
        assert!(ImportPlan::new(&mapping(&[Some("nope")]), &structure()).is_err());
        assert!(ImportPlan::new(&mapping(&[Some("total")]), &structure()).is_err());
        assert!(ImportPlan::new(&mapping(&[Some("email"), Some("email")]), &structure()).is_err());
    }

    #[test]
    fn batches_stay_below_the_placeholder_limit() {
        let one = ImportPlan {
            fields: 1,
            mapped: vec![(0, "a".to_string())],
        };
        let many = ImportPlan {
            fields: 100,
            mapped: (0..100).map(|i| (i, format!("c{i}"))).collect(),
        };
        let huge = ImportPlan {
            fields: 9000,
            mapped: (0..9000).map(|i| (i, format!("c{i}"))).collect(),
        };

        assert_eq!(one.rows_per_insert(), 1000);
        assert_eq!(many.rows_per_insert(), 80);
        assert_eq!(huge.rows_per_insert(), 1);
    }

    #[test]
    fn reads_batches_with_nulls_and_line_numbers() {
        let (_directory, path) = file("id,email,created_at\n11,a@example.com,2026-10-01\n12,b@example.com,\n13,\\N,x\n");
        let columns = mapping(&[None, Some("email"), Some("created_at")]);
        let plan = ImportPlan::new(&columns, &structure()).unwrap();
        let mut reader = ImportReader::open(&import(&path, true, columns), plan).unwrap();
        let batch = reader.next_batch().unwrap();

        assert_eq!(
            batch,
            vec![
                ImportRow {
                    line: 2,
                    values: vec![Some("a@example.com".to_string()), Some("2026-10-01".to_string())]
                },
                ImportRow {
                    line: 3,
                    values: vec![Some("b@example.com".to_string()), None]
                },
                ImportRow {
                    line: 4,
                    values: vec![None, Some("x".to_string())]
                },
            ]
        );
        assert!(reader.next_batch().unwrap().is_empty());
    }

    #[test]
    fn a_ragged_line_names_its_number() {
        let (_directory, path) = file("a,b\n1,2\n3\n");
        let columns = mapping(&[Some("id"), Some("email")]);
        let plan = ImportPlan::new(&columns, &structure()).unwrap();
        let error = ImportReader::open(&import(&path, true, columns), plan).unwrap().next_batch().unwrap_err();

        assert!(error.message.starts_with("Line 3 has 1 fields"), "{}", error.message);
    }

    #[test]
    fn samples_with_a_header() {
        let (_directory, path) = file("id,email\n1,a\n2,b\n3,c\n");
        let sample = sample(&SampleParams {
            path,
            format: DelimitedFormat::Csv,
            header: true,
            limit: Some(2),
        })
        .unwrap();

        assert_eq!(sample.columns, ["id", "email"]);
        assert_eq!(sample.rows, vec![vec!["1", "a"], vec!["2", "b"]]);
    }

    #[test]
    fn samples_without_a_header_and_pads_short_lines() {
        let (_directory, path) = file("1,a,x\n2\n");
        let sample = sample(&SampleParams {
            path,
            format: DelimitedFormat::Csv,
            header: false,
            limit: None,
        })
        .unwrap();

        assert_eq!(sample.columns, ["column1", "column2", "column3"]);
        assert_eq!(sample.rows, vec![vec!["1", "a", "x"], vec!["2", "", ""]]);
    }

    #[test]
    fn samples_an_empty_file() {
        let (_directory, path) = file("");
        let sample = sample(&SampleParams {
            path,
            format: DelimitedFormat::Csv,
            header: true,
            limit: None,
        })
        .unwrap();

        assert!(sample.columns.is_empty());
        assert!(sample.rows.is_empty());
    }

    #[test]
    fn builds_multi_row_inserts() {
        let names = vec!["email".to_string(), "created_at".to_string()];

        assert_eq!(
            insert_sql(Dialect::Mysql, "shop", "users", &names, 2),
            "INSERT INTO `shop`.`users` (`email`, `created_at`) VALUES (?, ?), (?, ?)"
        );
    }

    #[test]
    fn puts_the_line_in_front_of_the_message() {
        let error = DatabaseError::query_failed("Duplicate entry").with_sql_state("23000");
        let error = at_line(error, 7);

        assert_eq!(error.message, "Line 7: Duplicate entry");
        assert_eq!(error.sql_state.as_deref(), Some("23000"));
    }
}
