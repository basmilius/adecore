#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Dialect {
    Sqlite,
    Mysql,
}

impl Dialect {
    pub fn quote_ident(self, name: &str) -> String {
        match self {
            Dialect::Sqlite => format!("\"{}\"", name.replace('"', "\"\"")),
            Dialect::Mysql => format!("`{}`", name.replace('`', "``")),
        }
    }

    /// A `schema.table` pair, both quoted.
    pub fn qualified(self, schema: &str, table: &str) -> String {
        format!("{}.{}", self.quote_ident(schema), self.quote_ident(table))
    }
}

/// A string literal for MySQL, which also treats a backslash as an escape.
pub fn mysql_string_literal(value: &str) -> String {
    format!("'{}'", value.replace('\\', "\\\\").replace('\'', "''"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quotes_sqlite_identifiers() {
        assert_eq!(Dialect::Sqlite.quote_ident("users"), "\"users\"");
        assert_eq!(Dialect::Sqlite.quote_ident("we\"ird"), "\"we\"\"ird\"");
        assert_eq!(Dialect::Sqlite.quote_ident("back`tick"), "\"back`tick\"");
    }

    #[test]
    fn quotes_mysql_identifiers() {
        assert_eq!(Dialect::Mysql.quote_ident("users"), "`users`");
        assert_eq!(Dialect::Mysql.quote_ident("we`ird"), "`we``ird`");
        assert_eq!(Dialect::Mysql.quote_ident("dou\"ble"), "`dou\"ble`");
    }

    #[test]
    fn qualifies_names() {
        assert_eq!(Dialect::Mysql.qualified("shop", "users"), "`shop`.`users`");
    }

    #[test]
    fn escapes_mysql_literals() {
        assert_eq!(mysql_string_literal("it's"), "'it''s'");
        assert_eq!(mysql_string_literal("a\\b"), "'a\\\\b'");
    }
}
