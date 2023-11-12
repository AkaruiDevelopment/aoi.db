"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const utils_js_1 = require("../../utils.js");
const promises_1 = require("fs/promises");
const enum_js_1 = require("../../typings/enum.js");
class Referencer {
    cache = {};
    cacheSize = -1;
    #path;
    files;
    maxSize;
    type;
    constructor(path, maxSize, type) {
        this.type = type;
        this.#path = path;
        this.maxSize = maxSize;
    }
    /**
     * Description initialize the Referencer
     * @returns
     */
    async initialize() {
        this.files = (0, fs_1.readdirSync)(this.#path).map((file) => {
            return {
                name: file,
                size: (0, fs_1.statSync)(this.#path + "/" + file).size,
                writer: (0, fs_1.createWriteStream)(this.#path + "/" + file, {
                    flags: "a",
                    encoding: "utf-8",
                }),
            };
        });
        if (this.type === enum_js_1.ReferenceType.Cache)
            this.cache = await this.#getReference();
    }
    /**
     * @private
     * @description get reference from files
     * @returns
     */
    async #getReference() {
        const reference = {};
        for (const file of this.files) {
            const data = await (0, promises_1.readFile)(this.#path + "/" + file.name, "utf-8");
            if (data.trim() === "")
                return reference;
            const lines = data.split("\n");
            for (const line of lines) {
                const [key, value] = line.split(utils_js_1.ReferenceConstantSpace);
                reference[key] = {
                    file: value,
                    referenceFile: file.name,
                };
            }
        }
        return reference;
    }
    /**
     * @description get references
     * @returns
     *
     * @example
     * ```js
     * <Referencer>.getReference() // {key:{file:"file",referenceFile:"referenceFile"}}
     * ```
     */
    async getReference() {
        if (this.cacheSize === -1) {
            this.cache = await this.#getReference();
            this.cacheSize = Object.keys(this.cache).length;
            if (this.type === enum_js_1.ReferenceType.File)
                setTimeout(() => {
                    this.cache = {};
                    this.cacheSize = -1;
                }, 60000);
        }
        return this.cache;
    }
    /**
     * @private
     * @description save reference to file
     * @param key key to save
     * @param file file to save
     */
    #saveReference(key, file) {
        const string = `${key}${utils_js_1.ReferenceConstantSpace}${file}\n`;
        let currentFile = this.#currentFile();
        if (currentFile.size + string.length > this.maxSize) {
            this.#createFile();
            if (this.cacheSize !== -1) {
                this.cache[key].referenceFile = this.#currentFile().name;
            }
            currentFile = this.#currentFile();
        }
        currentFile.writer.write(string);
        this.files.at(-1).size += string.length;
    }
    /**
     * @description get current file
     * @private
     * @returns  current file
     */
    #currentFile() {
        return this.files.at(-1);
    }
    /**
     * @description create file
     * @private
     * @returns
     */
    #createFile() {
        const file = this.#path + "/reference_" + (this.files.length + 1) + ".log";
        this.files.push({
            name: "reference_" + (this.files.length + 1) + ".log",
            size: 0,
            writer: (0, fs_1.createWriteStream)(file, {
                flags: "a",
                encoding: "utf-8",
            }),
        });
    }
    /**
     * @description set reference
     * @param key key to set
     * @param file file to set
     *
     * @example
     *
     * ```js
     * <Referencer>.setReference("key","file")
     * ```
     */
    setReference(key, file) {
        if (this.cacheSize !== -1) {
            this.cache[key] = {
                file,
                referenceFile: this.#currentFile().name,
            };
            this.cacheSize++;
        }
        this.#saveReference(key, file);
    }
    /**
     * @description delete reference
     * @param key key to delete
     *
     * @example
     * ```js
     * <Referencer>.deleteReference("key")
     * ```
     */
    async deleteReference(key) {
        let referenceFile;
        if (this.cacheSize !== -1) {
            referenceFile = this.cache[key].referenceFile;
            delete this.cache[key];
            this.cacheSize--;
        }
        else {
            const reference = await this.getReference();
            referenceFile = reference[key].referenceFile;
        }
        await this.#deleteReference(key, referenceFile);
    }
    /**
     * @description delete reference
     * @private
     * @param key key to delete
     * @param file file to delete
     */
    async #deleteReference(key, file) {
        const reference = await this.#getFileReference(file);
        delete reference[key];
        const string = Object.entries(reference).map(([key, value]) => {
            return `${key}${utils_js_1.ReferenceConstantSpace}${value}\n`;
        });
        await (0, promises_1.truncate)(this.#path + "/" + file, 0);
        this.files
            .find((fil) => fil.name === file)
            .writer.write(string.join(""));
    }
    /**
     * @description get all references from file
     * @param file file to get reference
     * @returns
     */
    async #getFileReference(file) {
        const path = this.#path + "/" + file;
        const reference = {};
        const data = await (0, promises_1.readFile)(this.#path + "/" + file, "utf-8");
        const lines = data.split("\n");
        for (const line of lines) {
            const [key, value] = line.split(utils_js_1.ReferenceConstantSpace);
            reference[key] = value;
        }
        return reference;
    }
    /**
     * @description clear the Referencer
     *
     * @example
     * ```js
     * <Referencer>.clear()
     * ```
     */
    async clear() {
        for (const file of this.files) {
            file.size = 0;
            file.writer.close();
            if (file.name !== "reference_1.log") {
                await (0, promises_1.unlink)(this.#path + "/" + file.name);
            }
            else {
                await (0, promises_1.truncate)(this.#path + "/" + file.name, 0);
            }
        }
        this.files = this.files.slice(0, 1);
        this.cache = {};
        if (this.cacheSize !== -1) {
            this.cacheSize = -1;
        }
    }
    /**
     * @description open the Referencer
     *
     * @example
     * ```js
     * <Referencer>.open()
     * ```
     */
    open() {
        for (const file of this.files) {
            file.writer = (0, fs_1.createWriteStream)(this.#path + "/" + file.name, {
                flags: "a",
                encoding: "utf-8",
            });
        }
    }
    /**
     * @description restart the Referencer
     *
     * @example
     * ```js
     * <Referencer>.restart()
     * ```
     */
    restart() {
        for (const file of this.files) {
            if (!file.writer.closed)
                file.writer.close();
        }
        this.files = (0, fs_1.readdirSync)(this.#path).map((file) => {
            return {
                name: file,
                size: (0, fs_1.statSync)(this.#path + "/" + file).size,
                writer: (0, fs_1.createWriteStream)(this.#path + "/" + file, {
                    flags: "a",
                    encoding: "utf-8",
                }),
            };
        });
    }
}
exports.default = Referencer;
//# sourceMappingURL=referencer.js.map