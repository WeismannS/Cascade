import type { Wal2Json } from "pg-logical-replication"

type Wal2JsonChange = Wal2Json.Output["change"][number]

export class WalSQLSerializer {
    /**
     * Escapes a value for SQL based on its type
     */
    private static escapeValue(value: any, type: string): string {
        if (value === null || value === undefined) {
            return 'NULL';
        }
        if (type.includes('int') || type.includes('numeric') || type.includes('decimal') ||
            type.includes('float') || type.includes('double') || type.includes('real')) {
            return String(value);
        }
        if (type.includes('bool')) {
            return value ? 'TRUE' : 'FALSE';
        }
        return `'${String(value).replace(/'/g, "''")}'`;
    }

    /**
     * Escapes an identifier (table/column name) - always quotes for safety
     */
    private static escapeIdentifier(name: string): string {
        return `"${name.replace(/"/g, '""')}"`;
    }

    /**
     * Formats a table reference
     */
    private static formatTable(schema: string, table: string): string {
        const tableName = WalSQLSerializer.escapeIdentifier(table);

        if (schema !== 'public') {
            const schemaName = WalSQLSerializer.escapeIdentifier(schema);
            return `${schemaName}.${tableName}`;
        }

        return tableName;
    }

    /**
     * Generates INSERT statement
     */
    private static generateInsert(change: Wal2JsonChange): string {
        const table = WalSQLSerializer.formatTable(change.schema, change.table);
        const columns = change.columnnames.map(c => WalSQLSerializer.escapeIdentifier(c)).join(', ');
        const values = change.columnvalues
            .map((v, i) => WalSQLSerializer.escapeValue(v, change.columntypes[i] ?? 'text'))
            .join(', ');

        return `INSERT INTO ${table} (${columns}) VALUES (${values});`;
    }

    /**
     * Generates UPDATE statement
     */
    private static generateUpdate(change: Wal2JsonChange): string {
        const table = WalSQLSerializer.formatTable(change.schema, change.table);

        const setClauses = change.columnnames
            .map((col, i) => {
                const column = WalSQLSerializer.escapeIdentifier(col);
                const value = WalSQLSerializer.escapeValue(change.columnvalues[i], change.columntypes[i] ?? 'text');
                return `${column} = ${value}`;
            })
            .join(', ');

        let whereClause = '';
        if (change.oldkeys) {
            const conditions = change.oldkeys.keynames
                .map((key, i) => {
                    const column = WalSQLSerializer.escapeIdentifier(key);
                    const value = WalSQLSerializer.escapeValue(change.oldkeys!.keyvalues[i], change.oldkeys!.keytypes[i] ?? 'text');
                    return `${column} = ${value}`;
                })
                .join(' AND ');
            whereClause = ` WHERE ${conditions}`;
        }

        return `UPDATE ${table} SET ${setClauses}${whereClause}`;
    }

    /**
     * Generates DELETE statement
     */
    private static generateDelete(change: Wal2JsonChange): string {
        const table = WalSQLSerializer.formatTable(change.schema, change.table);

        let whereClause = '';
        if (change.oldkeys) {
            const conditions = change.oldkeys.keynames
                .map((key, i) => {
                    const column = WalSQLSerializer.escapeIdentifier(key);
                    const value = WalSQLSerializer.escapeValue(change.oldkeys!.keyvalues[i], change.oldkeys!.keytypes[i] ?? 'text');
                    return `${column} = ${value}`;
                })
                .join(' AND ');
            whereClause = ` WHERE ${conditions}`;
        }

        return `DELETE FROM ${table}${whereClause}`;
    }

    /**
     * Converts a single change to SQL
     */
    public static changeToSQL(change: Wal2JsonChange): string {
        switch (change.kind) {
            case 'insert':
                return WalSQLSerializer.generateInsert(change);
            case 'update':
                return WalSQLSerializer.generateUpdate(change);
            case 'delete':
                return WalSQLSerializer.generateDelete(change);
            default:
                throw new Error(`Unknown change kind: ${change.kind}`);
        }
    }

    /**
     * Converts a wal2json message (entire transaction) to SQL statements
     * Returns array of SQL statements, wrapped in BEGIN/COMMIT if more than one change
     */
    public static transactionToSQL(message: Wal2Json.Output): string[] {
        const statements: string[] = [];

        if (message.change.length > 1) {
            statements.push('BEGIN;');
        }

        for (const change of message.change) {
            statements.push(WalSQLSerializer.changeToSQL(change));
        }

        if (message.change.length > 1) {
            statements.push('COMMIT;');
        }

        return statements;
    }
    /**
     * Turn an event log from wal2json to an SQL statement
     */
    public static transactionToSQLScript(message: Wal2Json.Output): string {
        return WalSQLSerializer.transactionToSQL(message).join('\n');
    }
}
