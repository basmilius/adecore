use crate::protocol::ValueKind;

/// The kind of a declared SQLite type, following the affinity rules and then the common names.
pub fn sqlite_kind(declared: &str) -> ValueKind {
    let upper = declared.trim().to_uppercase();
    let has = |needle: &str| upper.contains(needle);

    if upper.is_empty() {
        ValueKind::Other
    } else if has("JSON") {
        ValueKind::Json
    } else if has("BOOL") {
        ValueKind::Boolean
    } else if has("INT") {
        ValueKind::Integer
    } else if has("CHAR") || has("CLOB") || has("TEXT") {
        ValueKind::Text
    } else if has("BLOB") {
        ValueKind::Binary
    } else if has("REAL") || has("FLOA") || has("DOUB") {
        ValueKind::Float
    } else if has("DECIMAL") || has("NUMERIC") {
        ValueKind::Decimal
    } else if has("DATETIME") || has("TIMESTAMP") {
        ValueKind::Datetime
    } else if has("DATE") {
        ValueKind::Date
    } else if has("TIME") {
        ValueKind::Time
    } else {
        ValueKind::Other
    }
}

/// The kind of a MySQL or MariaDB `COLUMN_TYPE`, such as `int(11) unsigned` or `enum('a','b')`.
pub fn mysql_kind(column_type: &str) -> ValueKind {
    let lower = column_type.trim().to_lowercase();
    let base = lower.split(['(', ' ']).next().unwrap_or_default();

    match base {
        "tinyint" | "smallint" | "mediumint" | "int" | "integer" | "bigint" | "year" => ValueKind::Integer,
        "decimal" | "numeric" | "dec" | "fixed" => ValueKind::Decimal,
        "float" | "double" | "real" => ValueKind::Float,
        "bool" | "boolean" => ValueKind::Boolean,
        "char" | "varchar" | "tinytext" | "text" | "mediumtext" | "longtext" | "enum" | "set" | "uuid" | "inet4" | "inet6" => ValueKind::Text,
        "binary" | "varbinary" | "tinyblob" | "blob" | "mediumblob" | "longblob" | "bit" | "geometry" | "point" | "linestring" | "polygon" | "multipoint"
        | "multilinestring" | "multipolygon" | "geometrycollection" | "vector" => ValueKind::Binary,
        "date" => ValueKind::Date,
        "time" => ValueKind::Time,
        "datetime" | "timestamp" => ValueKind::Datetime,
        "json" => ValueKind::Json,
        _ => ValueKind::Other,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_sqlite_declared_types() {
        let cases = [
            ("INTEGER", ValueKind::Integer),
            ("BIGINT", ValueKind::Integer),
            ("UNSIGNED BIG INT", ValueKind::Integer),
            ("TINYINT(1)", ValueKind::Integer),
            ("BOOLEAN", ValueKind::Boolean),
            ("VARCHAR(255)", ValueKind::Text),
            ("NCHAR(10)", ValueKind::Text),
            ("CLOB", ValueKind::Text),
            ("TEXT", ValueKind::Text),
            ("JSON", ValueKind::Json),
            ("JSONB", ValueKind::Json),
            ("BLOB", ValueKind::Binary),
            ("REAL", ValueKind::Float),
            ("FLOAT", ValueKind::Float),
            ("DOUBLE PRECISION", ValueKind::Float),
            ("DECIMAL(10,5)", ValueKind::Decimal),
            ("NUMERIC", ValueKind::Decimal),
            ("DATETIME", ValueKind::Datetime),
            ("TIMESTAMP", ValueKind::Datetime),
            ("DATE", ValueKind::Date),
            ("TIME", ValueKind::Time),
            ("", ValueKind::Other),
            ("WHATEVER", ValueKind::Other),
        ];

        for (declared, kind) in cases {
            assert_eq!(sqlite_kind(declared), kind, "{declared}");
        }
    }

    #[test]
    fn maps_mysql_column_types() {
        let cases = [
            ("int(11) unsigned", ValueKind::Integer),
            ("tinyint(1)", ValueKind::Integer),
            ("bigint(20)", ValueKind::Integer),
            ("year(4)", ValueKind::Integer),
            ("decimal(10,2)", ValueKind::Decimal),
            ("double", ValueKind::Float),
            ("varchar(255)", ValueKind::Text),
            ("longtext", ValueKind::Text),
            ("enum('a','b')", ValueKind::Text),
            ("set('a','b')", ValueKind::Text),
            ("varbinary(16)", ValueKind::Binary),
            ("mediumblob", ValueKind::Binary),
            ("bit(1)", ValueKind::Binary),
            ("point", ValueKind::Binary),
            ("date", ValueKind::Date),
            ("time(3)", ValueKind::Time),
            ("datetime(6)", ValueKind::Datetime),
            ("timestamp", ValueKind::Datetime),
            ("json", ValueKind::Json),
            ("something", ValueKind::Other),
        ];

        for (column_type, kind) in cases {
            assert_eq!(mysql_kind(column_type), kind, "{column_type}");
        }
    }
}
