import File from "./File.js";
import { readdirSync } from "node:fs";
export default class FileManager {
    #maxSize;
    #hashSize;
    #array;
    #table;
    constructor(maxSize, hashSize = 20, table) {
        this.#maxSize = maxSize;
        this.#hashSize = hashSize;
        this.#table = table;
    }
    initialize() {
        const filesCount = readdirSync(this.#table.paths.table).length;
        this.#hashSize = Math.max(this.#hashSize, filesCount);
        this.#array = Array.from({ length: this.#hashSize }, (_, i) => {
            return new File(`${this.#table.paths.table}/${this.#table.options.name}_scheme_${i + 1}${this.#table.db.options.fileConfig.extension}`, this.#table.db.options.fileConfig.maxSize / 4, this.#table);
        });
        if (this.#table.db.options.fileConfig.reHashOnStartup) {
            this.#rehash();
        }
    }
    get maxHashArraySize() {
        return this.#maxSize;
    }
    get hashSize() {
        return this.#hashSize;
    }
    #hash(key) {
        const hash = key.split("").reduce((a, b) => {
            a += b.charCodeAt(0);
            return a & a;
        }, 1);
        return hash.toString(16);
    }
    add(data) {
        const hash = this.#hash(data.key);
        const index = this.#getHashIndex(hash);
        data.file = this.#array[index].name;
        this.#array[index].put(data.key, data);
        if (this.#array[index].size > this.#maxSize) {
            this.#rehash();
        }
    }
    #getHashIndex(hash) {
        const hashValue = parseInt(hash, 16);
        return hashValue % this.#hashSize;
    }
    async #rehash() {
        const newArraySize = this.#hashSize * 2;
        const newArray = Array.from({ length: newArraySize }, (_, i) => {
            return new File(`${this.#table.paths.table}/${this.#table.options.name}_scheme_${i}${this.#table.db.options.fileConfig.extension}`, this.#table.db.options.fileConfig.maxSize / 4, this.#table);
        });
        for (const file of this.#array) {
            const data = await file.getAll();
            for (const value of data) {
                const hash = this.#hash(value.key);
                const index = this.#getHashIndex(hash);
                newArray[index].put(value.key, value);
            }
        }
        this.#array = newArray;
        this.#hashSize = newArraySize;
    }
    remove(data) {
        const hash = this.#hash(data);
        const index = this.#getHashIndex(hash);
        this.#array[index].remove(data);
    }
    get(key) {
        const hash = this.#hash(key);
        const index = this.#getHashIndex(hash);
        return this.#array[index].get(key);
    }
    clear() {
        for (const file of this.#array) {
            file.clear();
        }
    }
    has(key) {
        const hash = this.#hash(key);
        const index = this.#getHashIndex(hash);
        return this.#array[index].has(key);
    }
    async all(query, limit, order) {
        if (order === "firstN") {
            const data = new Set();
            for (const file of this.#array) {
                for (const value of file.cache.all()) {
                    data.add(value);
                    if (data.size === limit)
                        return Array.from(data);
                }
            }
            for (const file of this.#array) {
                const d = await file.getAll(query);
                for (const value of d) {
                    data.add(value);
                    if (data.size == limit)
                        return Array.from(data);
                }
            }
            return Array.from(data);
        }
        else {
            const data = [];
            for (const file of this.#array) {
                const d = await file.getAll(query);
                for (const value of d) {
                    data.push(value);
                }
            }
            if (order === "asc") {
                data.sort((a, b) => a.key.localeCompare(b.key));
            }
            else {
                data.sort((a, b) => b.key.localeCompare(a.key));
            }
            return data.slice(0, limit);
        }
    }
    async findOne(query) {
        for (const file of this.#array) {
            const d = await file.findOne(query);
            if (d)
                return d;
        }
    }
    async findMany(query) {
        const data = [];
        for (const file of this.#array) {
            const d = await file.getAll(query);
            for (const value of d) {
                data.push(value);
            }
        }
        return data;
    }
    async getFirstN(query, limit) {
        const data = [];
        for (const file of this.#array) {
            const d = await file.getAll(query);
            for (const value of d) {
                data.push(value);
                if (data.length == limit)
                    return data;
            }
        }
        return data;
    }
    async removeMany(query) {
        for (const file of this.#array) {
            await file.removeMany(query);
        }
    }
    async ping() {
        let sum = 0;
        for (const file of this.#array) {
            sum += await file.ping();
        }
        return sum / this.#hashSize;
    }
}
//# sourceMappingURL=FileManager.js.map