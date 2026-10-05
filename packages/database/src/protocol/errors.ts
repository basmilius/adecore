/*
 * Why a request failed. The helper sends the first group; the host adds `helper-exited` and
 * `helper-unavailable`, and `forbidden` when the app's check turns a connection, a file or a discovery down.
 */
export type DatabaseErrorCode =
    /* The request does not have the shape of the protocol. */
    | 'invalid-request'
    /* The session was closed, or belonged to a helper that has since exited. */
    | 'unknown-session'
    | 'connect-failed'
    | 'auth-failed'
    /* The SSH or Docker tunnel did not come up; `message` holds what `ssh` or `docker` said. */
    | 'tunnel-failed'
    /* The server turned the SQL down; `sqlState` and `message` say why. */
    | 'query-failed'
    /* A write on a connection opened read only. */
    | 'read-only'
    /* An update or a delete on a table without a primary key or a unique key over columns that cannot be null. */
    | 'no-row-key'
    /* An update or a delete matched no row or more than one, so the transaction was rolled back. */
    | 'conflict'
    | 'cancelled'
    | 'unsupported'
    /* A file to export to or import from could not be read or written. */
    | 'file-failed'
    | 'forbidden'
    | 'helper-exited'
    | 'helper-unavailable'
    | 'internal';

export interface DatabaseError {
    readonly code: DatabaseErrorCode;
    readonly message: string;
    /* The five characters of SQLSTATE, when the server sent them. */
    readonly sqlState?: string;
    /* For `conflict`: which change of the request it was, counted from zero. */
    readonly change?: number;
}
