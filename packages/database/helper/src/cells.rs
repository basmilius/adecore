use std::time::Duration;

use serde_json::Number;

use crate::protocol::{Cell, CellObject, InsertId, Value};

pub const MAX_SAFE_INTEGER: i64 = 9_007_199_254_740_991;

pub fn int_cell(value: i64) -> Cell {
    if (-MAX_SAFE_INTEGER..=MAX_SAFE_INTEGER).contains(&value) {
        Cell::Number(Number::from(value))
    } else {
        Cell::Text(value.to_string())
    }
}

pub fn uint_cell(value: u64) -> Cell {
    if value <= MAX_SAFE_INTEGER as u64 {
        Cell::Number(Number::from(value))
    } else {
        Cell::Text(value.to_string())
    }
}

pub fn insert_id(value: i128) -> InsertId {
    if value.abs() <= i128::from(MAX_SAFE_INTEGER) {
        InsertId::Number(value as i64)
    } else {
        InsertId::Text(value.to_string())
    }
}

/// Floats JSON cannot carry (NaN and the infinities) cross as their names.
pub fn float_cell(value: f64) -> Cell {
    match Number::from_f64(value) {
        Some(number) => Cell::Number(number),
        None if value.is_nan() => Cell::Text("NaN".to_string()),
        None if value.is_sign_negative() => Cell::Text("-Infinity".to_string()),
        None => Cell::Text("Infinity".to_string()),
    }
}

pub fn text_cell(text: &str, limit: usize) -> Cell {
    match text.char_indices().nth(limit) {
        None => Cell::Text(text.to_string()),
        Some((offset, _)) => Cell::Object(CellObject::LongText {
            preview: text[..offset].to_string(),
            length: text.chars().count() as u64,
        }),
    }
}

pub fn binary_cell(bytes: &[u8], limit: usize) -> Cell {
    let shown = &bytes[..bytes.len().min(limit)];

    Cell::Object(CellObject::Binary {
        hex: to_hex(shown),
        length: bytes.len() as u64,
    })
}

pub fn to_hex(bytes: &[u8]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);

    for byte in bytes {
        out.push(DIGITS[(byte >> 4) as usize] as char);
        out.push(DIGITS[(byte & 0x0f) as usize] as char);
    }

    out
}

pub fn from_hex(hex: &str) -> Option<Vec<u8>> {
    let bytes = hex.as_bytes();

    if !bytes.len().is_multiple_of(2) {
        return None;
    }

    let digit = |byte: u8| match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    };

    bytes.chunks(2).map(|pair| Some(digit(pair[0])? << 4 | digit(pair[1])?)).collect()
}

/// The whole value behind a cell that was read without a limit.
pub fn cell_to_value(cell: Cell) -> Value {
    match cell {
        Cell::Null => Value::Null,
        Cell::Bool(value) => Value::Bool(value),
        Cell::Number(number) => Value::Number(number),
        Cell::Text(text) => Value::Text(text),
        Cell::Object(CellObject::Binary { hex, .. }) => Value::binary(hex),
        Cell::Object(CellObject::LongText { preview, .. }) => Value::Text(preview),
    }
}

/// Milliseconds with one decimal.
pub fn elapsed_ms(elapsed: Duration) -> f64 {
    (elapsed.as_secs_f64() * 10_000.0).round() / 10.0
}

#[cfg(test)]
mod tests {
    use super::*;

    fn number(cell: &Cell) -> String {
        match cell {
            Cell::Number(number) => number.to_string(),
            other => panic!("not a number: {other:?}"),
        }
    }

    #[test]
    fn integers_inside_the_safe_range_are_numbers() {
        assert_eq!(number(&int_cell(42)), "42");
        assert_eq!(number(&int_cell(MAX_SAFE_INTEGER)), "9007199254740991");
        assert_eq!(number(&int_cell(-MAX_SAFE_INTEGER)), "-9007199254740991");
    }

    #[test]
    fn larger_integers_are_strings() {
        assert_eq!(int_cell(MAX_SAFE_INTEGER + 2), Cell::Text("9007199254740993".to_string()));
        assert_eq!(int_cell(i64::MIN), Cell::Text(i64::MIN.to_string()));
        assert_eq!(uint_cell(u64::MAX), Cell::Text(u64::MAX.to_string()));
        assert_eq!(number(&uint_cell(7)), "7");
    }

    #[test]
    fn floats_that_json_cannot_hold_are_strings() {
        assert_eq!(float_cell(f64::NAN), Cell::Text("NaN".to_string()));
        assert_eq!(float_cell(f64::INFINITY), Cell::Text("Infinity".to_string()));
        assert_eq!(float_cell(f64::NEG_INFINITY), Cell::Text("-Infinity".to_string()));
        assert_eq!(number(&float_cell(1.5)), "1.5");
    }

    #[test]
    fn text_is_cut_by_characters() {
        assert_eq!(text_cell("abc", 3), Cell::Text("abc".to_string()));
        assert_eq!(
            text_cell("abcd", 3),
            Cell::Object(CellObject::LongText {
                preview: "abc".to_string(),
                length: 4
            })
        );
        assert_eq!(
            text_cell("héllo wörld", 4),
            Cell::Object(CellObject::LongText {
                preview: "héll".to_string(),
                length: 11
            })
        );
    }

    #[test]
    fn binary_is_cut_by_bytes() {
        assert_eq!(
            binary_cell(&[0, 255, 16], 2),
            Cell::Object(CellObject::Binary {
                hex: "00ff".to_string(),
                length: 3
            })
        );
        assert_eq!(
            binary_cell(&[1], 8),
            Cell::Object(CellObject::Binary {
                hex: "01".to_string(),
                length: 1
            })
        );
    }

    #[test]
    fn hex_round_trips() {
        assert_eq!(to_hex(&[0, 1, 171, 255]), "0001abff");
        assert_eq!(from_hex("0001ABff"), Some(vec![0, 1, 171, 255]));
        assert_eq!(from_hex("abc"), None);
        assert_eq!(from_hex("zz"), None);
    }

    #[test]
    fn elapsed_time_has_one_decimal() {
        assert_eq!(elapsed_ms(Duration::from_micros(1234)), 1.2);
        assert_eq!(elapsed_ms(Duration::from_micros(40)), 0.0);
        assert_eq!(elapsed_ms(Duration::from_micros(450)), 0.5);
    }
}
