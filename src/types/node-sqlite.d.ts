declare module "node:sqlite" {
  export interface SQLiteResult {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  }

  export interface StatementSync {
    run(...params: Array<string | number | bigint | null | Uint8Array>): SQLiteResult;
    get(...params: Array<string | number | bigint | null | Uint8Array>): unknown;
    all(...params: Array<string | number | bigint | null | Uint8Array>): unknown[];
    setReadBigInts(enabled: boolean): void;
    sourceSQL: string;
  }

  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
    open(): void;
    isOpen: boolean;
  }
}
