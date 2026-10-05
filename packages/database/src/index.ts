/* The views of the package and the client they read through. Every name here is public API; `exports.test.ts` turns a change to this list into a diff someone has to accept. */

export {
    createDatabaseClient,
    DatabaseRequestError,
    type Connection,
    type DatabaseClient,
    type DatabaseClientOptions,
    type DatabaseSession,
    type DatabaseTransport,
    type ExecuteOptions,
    type ExecuteResult,
    type ExportRequest,
    type ExportResult,
    type ImportRequest,
    type PageQuery,
    type RequestOptions,
    type RowsQuery,
    type SchemaChange,
    type TableRef
} from './client/index.ts';

export type { DatabaseAction, DatabaseFiles, DatabaseStorage, ExplorerSelection } from './actions.ts';

export { ConnectionForm, type ConnectionFormProps } from './connections/ConnectionForm.tsx';
export { ConnectionManager, type ConnectionManagerProps } from './connections/ConnectionManager.tsx';
export { DatabaseExplorer, type DatabaseExplorerProps } from './explorer/DatabaseExplorer.tsx';
export { TableDesigner, type TableDesignerProps } from './designer/TableDesigner.tsx';
export { DatabaseProvider, type DatabaseProviderProps } from './DatabaseProvider.tsx';
export { useDatabaseClient } from './client-context.ts';
export { QueryConsole, type QueryConsoleProps } from './console/QueryConsole.tsx';
export { StructureView, type StructureViewProps } from './structure/StructureView.tsx';
export { TableView, type TableViewProps } from './table/TableView.tsx';
export { DatabaseWorkbench, type DatabaseWorkbenchProps } from './workbench/DatabaseWorkbench.tsx';

export { addDatabaseResources, DATABASE_NAMESPACE, DATABASE_RESOURCES } from './locales.ts';
