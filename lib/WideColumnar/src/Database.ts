import EventEmitter from "events";
import { DatabaseEvents, DeepRequired, ReferenceType, WideColumnarDataType } from "../../index.js";
import { WideColumnarOptions } from "../typings/interface.js";
import WideColumnarTable from "./Table.js";
import path from "path";
import { createWriteStream, existsSync, mkdirSync, writeFileSync } from "fs";
import WideColumnarData from "./Data.js";
import tar from "tar";

export default class WideColumnar extends EventEmitter {

    tables: {
        [key: string]: {
            ready: boolean;
            table: WideColumnarTable;
        };
    } = {};
    #options: DeepRequired<WideColumnarOptions>;
    readyAt: number = -1;
    constructor(options: WideColumnarOptions) {
        super();
        //@ts-ignore
        this.#options = this.#finalizeOptions(options);
    }

    get options() {
        return this.#options;
    }

    static defaultOptions: Required<WideColumnarOptions> = {
        dataConfig: {
            path: "./database",
            tables: [
                {
                    name: "main",
                    columns: [
                        {
                            name: "id",
                            primaryKey: true,
                            default: "0",
                            type: "string",
                        },
                        {
                            name: "var",
                            primaryKey: false,
                            default: "0",
                            type: "string",
                        },
                    ],
                },
            ],
            referencePath: "./reference",
        },
        cacheConfig: {
            limit: 20 * 1024 * 1024,
            sortFunction: (a, b) => {
                if (a.column && a.column.value && b.column && b.column.value) {
                    return a.column.value > b.column.value ? 1 : -1;
                }
                return 0;
            },
            referenceType: ReferenceType.File,
        },
        encryptionConfig: {
            securityKey: "a-32-characters-long-string-here",
        },
        fileConfig: {
            extension: ".wcd",
        },
        debug: false,
    };

    #finalizeOptions(options: WideColumnarOptions) {
        const defaultOptions = WideColumnar.defaultOptions;

        return {
            dataConfig: {
                path:
                    options.dataConfig?.path || defaultOptions.dataConfig.path,
                tables:
                    options.dataConfig?.tables ||
                    defaultOptions.dataConfig.tables,
                referencePath:
                    options.dataConfig?.referencePath ||
                    defaultOptions.dataConfig.referencePath,
            },
            cacheConfig: {
                limit:
                    options.cacheConfig?.limit ||
                    defaultOptions.cacheConfig.limit,
                sortFunction:
                    options.cacheConfig?.sortFunction ||
                    defaultOptions.cacheConfig.sortFunction,
                referenceType:
                    options.cacheConfig?.referenceType ||
                    defaultOptions.cacheConfig.referenceType,
            },
            encryptionConfig: {
                securityKey:
                    options.encryptionConfig?.securityKey ||
                    defaultOptions.encryptionConfig.securityKey,
            },
            fileConfig: {
                extension:
                    options.fileConfig?.extension ||
                    defaultOptions.fileConfig.extension,
            },
            debug: options.debug || defaultOptions.debug,
        };
    }

    async connect() {
        const isReady = (table: WideColumnarTable) => {
            this.tables[table.name].ready = true;

            for (const t of this.#options.dataConfig.tables) {
                if (!this.tables[t.name]?.ready) return;
            }
            this.readyAt = Date.now();
            this.removeListener(DatabaseEvents.TableReady, isReady);
            this.emit(DatabaseEvents.Connect);
        };
        this.on(DatabaseEvents.TableReady, isReady);
        const referencePath = path.join(
            this.#options.dataConfig.path,
            this.#options.dataConfig.referencePath,
        );
        if (!existsSync(referencePath)) {
            mkdirSync(referencePath, { recursive: true });
        }

        const backupPath = path.join(this.#options.dataConfig.path, ".backup");
        if (!existsSync(backupPath)) {
            mkdirSync(backupPath, { recursive: true });
        }

        for (const table of this.#options.dataConfig.tables) {
            this.tables[table.name] = {
                ready: false,
                table: new WideColumnarTable({
                    name: table.name,
                    columns: table.columns,
                    db: this,
                }),
            };
            await this.tables[table.name].table.connect();
        }
    }

    getTable(name: string) {
        return this.tables[name].table;
    }

    async set(
        table: string,
        column: {
            name: string;
            value: any;
        },
        primary: {
            name: string;
            value: any;
        },
    ) {
        const t = this.tables[table];
        if (!t) throw new Error(`Table ${table} does not exist`);
        return await t.table.set(column, primary);
    }

    async get(table: string, columnName: string, primary: WideColumnarDataType) {
        const t = this.tables[table];
        if (!t) throw new Error(`Table ${table} does not exist`);
        return await t.table.get(columnName, primary);
    }

    async delete(table: string, columnName: string, primary: WideColumnarDataType) {
        const t = this.tables[table];
        if (!t) throw new Error(`Table ${table} does not exist`);
        return await t.table.delete(columnName, primary);
    }

    async all(
        table: string,
        columnName: string,
        query: (data: WideColumnarData) => boolean,
    ) {
        const t = this.tables[table];
        if (!t) throw new Error(`Table ${table} does not exist`);
        return await t.table.all(columnName, query);
    }

    async allColumns(
        table: string,
        query: (data: WideColumnarData) => boolean,
    ) {
        const t = this.tables[table];
        if (!t) throw new Error(`Table ${table} does not exist`);
        return await t.table.allColumns(query);
    }

    async allTable(query: (data: WideColumnarData) => boolean) {
        const tables = [];
        for (const table of Object.keys(this.tables)) {
            tables.push(...(await this.tables[table].table.allColumns(query)));
        }
        return tables;
    }

    async clear(table: string) {
        const t = this.tables[table];
        if (!t) throw new Error(`Table ${table} does not exist`);
        return await t.table.clear();
    }

    async clearAll() {
        for (const table of Object.keys(this.tables)) {
            await this.tables[table].table.clear();
        }
    }

    async deleteMany(
        table: string,
        columnName: string,
        query: (data: WideColumnarData) => boolean,
    ) {
        const t = this.tables[table];
        if (!t) throw new Error(`Table ${table} does not exist`);
        return await t.table.deleteMany(columnName, query);
    }

    async findMany(
        table: string,
        columnName: string,
        query: (data: WideColumnarData) => boolean,
    ) {
        const t = this.tables[table];
        if (!t) throw new Error(`Table ${table} does not exist`);
        return await t.table.findMany(columnName, query);
    }

    async findOne(
        table: string,
        columnName: string,
        query: (data: WideColumnarData) => boolean,
    ) {
        const t = this.tables[table];
        if (!t) throw new Error(`Table ${table} does not exist`);
        return await t.table.findOne(columnName, query);
    }

    async has(table: string, columnName: string, primary: WideColumnarDataType) {
        const t = this.tables[table];
        if (!t) throw new Error(`Table ${table} does not exist`);
        return await t.table.has(columnName, primary);
    }

    async fullRepair(table: string) {
        const t = this.tables[table];
        if (!t) throw new Error(`Table ${table} does not exist`);
        return await t.table.fullRepair();
    }

    backup() {
        const backupPath = `${this.#options.dataConfig.path}/.backup`;
        const backupName = `${backupPath}/Snapshot_${new Date()
            .toISOString()
            .replaceAll(" ", "_")
            .replaceAll(",", "_")
            .replaceAll(":", "_")}.tar.gz`;
        writeFileSync(backupName, "");
        const writer = createWriteStream(backupName);
        tar.c(
            {
                gzip: true,
            },
            [
                this.#options.dataConfig.referencePath,
                ...Object.keys(this.tables).map((table) => {
                    return `${this.#options.dataConfig.path}/${table}`;
                }),
            ],
        ).pipe(writer);
    }
}
