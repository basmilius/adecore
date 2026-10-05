//! Reads CSV and TSV files for `sample` and `import`.

use std::fs::File;
use std::io::{BufRead, BufReader};

use csv::{ByteRecord, ReaderBuilder};

use crate::error::{DatabaseError, Result};
use crate::protocol::DelimitedFormat;

const BYTE_ORDER_MARK: [u8; 3] = [0xEF, 0xBB, 0xBF];
/// A TSV field that is exactly this stands for NULL.
const NULL_MARKER: &str = "\\N";

/// One line of the file with the fields as text.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Line {
    pub number: u64,
    pub fields: Vec<String>,
}

/// Counts the lines of the file on its own: the csv crate lags one line behind after a CRLF terminator.
struct LineCounter {
    file: BufReader<File>,
    scanned: u64,
    newlines: u64,
}

impl LineCounter {
    /// The line that holds the byte at `offset`, or the line before it when that byte is the `\n` of a CRLF the csv crate has not passed yet.
    fn line_at(&mut self, offset: u64) -> Result<u64> {
        let target = offset + 1;

        while self.scanned < target {
            let buffer = self.file.fill_buf()?;

            if buffer.is_empty() {
                break;
            }

            let take = buffer.len().min((target - self.scanned) as usize);
            self.newlines += buffer[..take].iter().filter(|byte| **byte == b'\n').count() as u64;
            self.file.consume(take);
            self.scanned += take as u64;
        }

        Ok(1 + self.newlines)
    }
}

pub struct DelimitedReader {
    reader: csv::Reader<BufReader<File>>,
    lines: LineCounter,
    format: DelimitedFormat,
    record: ByteRecord,
}

impl DelimitedReader {
    pub fn open(path: &str, format: DelimitedFormat) -> Result<DelimitedReader> {
        let mut source = BufReader::new(File::open(path)?);
        let mut lines = LineCounter {
            file: BufReader::new(File::open(path)?),
            scanned: 0,
            newlines: 0,
        };

        if source.fill_buf()?.starts_with(&BYTE_ORDER_MARK) {
            source.consume(BYTE_ORDER_MARK.len());
            lines.file.fill_buf()?;
            lines.file.consume(BYTE_ORDER_MARK.len());
        }

        let mut builder = ReaderBuilder::new();
        builder.has_headers(false).flexible(true);

        match format {
            DelimitedFormat::Csv => builder.delimiter(b','),
            DelimitedFormat::Tsv => builder.delimiter(b'\t').quoting(false),
        };

        Ok(DelimitedReader {
            reader: builder.from_reader(source),
            lines,
            format,
            record: ByteRecord::new(),
        })
    }

    /// The next line, or `None` at the end of the file.
    pub fn next_line(&mut self) -> Result<Option<Line>> {
        let more = self
            .reader
            .read_byte_record(&mut self.record)
            .map_err(|e| DatabaseError::file_failed(e.to_string()))?;

        if !more {
            return Ok(None);
        }

        let number = match self.record.position() {
            Some(position) => self.lines.line_at(position.byte())?,
            None => 0,
        };
        let mut fields = Vec::with_capacity(self.record.len());

        for field in self.record.iter() {
            let text = std::str::from_utf8(field).map_err(|_| DatabaseError::file_failed(format!("Line {number} is not valid UTF-8.")))?;

            fields.push(text.to_string());
        }

        Ok(Some(Line { number, fields }))
    }

    /// What a field stands for: `None` for NULL, else its text with TSV escapes undone.
    pub fn value_of(&self, field: &str) -> Option<String> {
        if field.is_empty() {
            return None;
        }

        match self.format {
            DelimitedFormat::Csv => (field != NULL_MARKER).then(|| field.to_string()),
            DelimitedFormat::Tsv => (field != NULL_MARKER).then(|| unescape_tsv(field)),
        }
    }
}

/// Undoes `\t`, `\n`, `\r` and `\\`; any other backslash stays as it is.
pub fn unescape_tsv(field: &str) -> String {
    if !field.contains('\\') {
        return field.to_string();
    }

    let mut text = String::with_capacity(field.len());
    let mut characters = field.chars();

    while let Some(character) = characters.next() {
        if character != '\\' {
            text.push(character);

            continue;
        }

        match characters.clone().next() {
            Some('t') => text.push('\t'),
            Some('n') => text.push('\n'),
            Some('r') => text.push('\r'),
            Some('\\') => text.push('\\'),
            _ => {
                text.push('\\');

                continue;
            }
        }

        characters.next();
    }

    text
}

#[cfg(test)]
mod tests {
    use super::*;

    fn read(content: &[u8], format: DelimitedFormat) -> Vec<Line> {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("data");
        std::fs::write(&path, content).unwrap();
        let mut reader = DelimitedReader::open(path.to_str().unwrap(), format).unwrap();
        let mut lines = Vec::new();

        while let Some(line) = reader.next_line().unwrap() {
            lines.push(line);
        }

        lines
    }

    fn fields(line: &Line) -> Vec<&str> {
        line.fields.iter().map(String::as_str).collect()
    }

    #[test]
    fn reads_csv_with_quotes_and_line_numbers() {
        let lines = read(b"id,note\r\n1,\"a,b\"\r\n2,\"two\nlines\"\r\n3,\"say \"\"hi\"\"\"\r\n", DelimitedFormat::Csv);

        assert_eq!(fields(&lines[0]), ["id", "note"]);
        assert_eq!(fields(&lines[1]), ["1", "a,b"]);
        assert_eq!(fields(&lines[2]), ["2", "two\nlines"]);
        assert_eq!(fields(&lines[3]), ["3", "say \"hi\""]);
        assert_eq!(lines.iter().map(|line| line.number).collect::<Vec<_>>(), vec![1, 2, 3, 5]);
    }

    #[test]
    fn skips_a_byte_order_mark_and_keeps_ragged_lines() {
        let lines = read(b"\xEF\xBB\xBFa,b\n1\n1,2,3\n", DelimitedFormat::Csv);

        assert_eq!(fields(&lines[0]), ["a", "b"]);
        assert_eq!(fields(&lines[1]), ["1"]);
        assert_eq!(fields(&lines[2]), ["1", "2", "3"]);
    }

    #[test]
    fn reads_tsv_without_quoting() {
        let lines = read(b"a\tb\n\"x\ty\"\t\\N\n", DelimitedFormat::Tsv);

        assert_eq!(fields(&lines[1]), ["\"x", "y\"", "\\N"]);
    }

    #[test]
    fn values_follow_the_null_rules() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("data");
        std::fs::write(&path, "").unwrap();
        let csv = DelimitedReader::open(path.to_str().unwrap(), DelimitedFormat::Csv).unwrap();
        let tsv = DelimitedReader::open(path.to_str().unwrap(), DelimitedFormat::Tsv).unwrap();

        assert_eq!(csv.value_of(""), None);
        assert_eq!(csv.value_of("\\N"), None);
        assert_eq!(csv.value_of("a\\tb"), Some("a\\tb".to_string()));
        assert_eq!(tsv.value_of(""), None);
        assert_eq!(tsv.value_of("\\N"), None);
        assert_eq!(tsv.value_of("a\\tb"), Some("a\tb".to_string()));
    }

    #[test]
    fn unescapes_what_the_exporter_escapes() {
        assert_eq!(unescape_tsv("tab\\there\\nnew\\\\slash\\rcr"), "tab\there\nnew\\slash\rcr");
        assert_eq!(unescape_tsv("C:\\temp\\x"), "C:\temp\\x");
        assert_eq!(unescape_tsv("trailing\\"), "trailing\\");
        assert_eq!(unescape_tsv("\\\\n"), "\\n");
    }

    #[test]
    fn invalid_utf8_names_the_line() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("data");
        std::fs::write(&path, b"a\n\xff\n").unwrap();
        let mut reader = DelimitedReader::open(path.to_str().unwrap(), DelimitedFormat::Csv).unwrap();
        reader.next_line().unwrap();
        let error = reader.next_line().unwrap_err();

        assert_eq!(error.code, crate::error::ErrorCode::FileFailed);
        assert!(error.message.contains("Line 2"), "{}", error.message);
    }

    #[test]
    fn a_missing_file_is_a_file_error() {
        let error = DelimitedReader::open("/no/such/file.csv", DelimitedFormat::Csv).err().unwrap();

        assert_eq!(error.code, crate::error::ErrorCode::FileFailed);
        assert!(error.message.contains("No such file or directory"));
    }
}
