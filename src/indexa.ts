/*
 * Copyright (c) 2026 UndeffinedDev
 * Licensed under the MIT License.
 */
type StoreConfig = {
  keyPath: string;
  autoIncrement?: boolean;
};

type DBSchemaConfig = Record<string, StoreConfig>;

type Subscriber<T> = (data: T[]) => void;


export class Indexa<TSchema extends Record<string, any>> {
  private dbName: string;
  private dbVersion: number;
  private stores: DBSchemaConfig;
  private dbPromise: Promise<IDBDatabase>;
  private subscribers: Record<string, Subscriber<any>[]> = {};
  private static debugEnabled: boolean = false;

  /**
   * Enable or disable debug messages globally for all Indexa instances.
   * @param enabled true to enable debug messages, false to disable
   */
  static setDebug(enabled: boolean) {
    Indexa.debugEnabled = enabled;
  }

  /**
   * Internal debug log method
   */
  private debugLog(...args: any[]) {
    if (Indexa.debugEnabled) {
      // eslint-disable-next-line no-console
      console.log('[Indexa]', ...args);
    }
  }

  /**
   * Creates a new instance of the Indexa database wrapper.
   * @param name The name of the IndexedDB database.
   * @param version The version of the database schema.
   * @param stores The schema configuration for object stores.
   */
  constructor(name: string, version: number, stores: DBSchemaConfig) {
    this.dbName = name;
    this.dbVersion = version;
    this.stores = stores;
    this.dbPromise = this.init();
  }

  private init(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = () => {
        const db = request.result;
        for (const storeName in this.stores) {
          if (!db.objectStoreNames.contains(storeName)) {
            const config = this.stores[storeName];
            db.createObjectStore(storeName, {
              keyPath: config.keyPath,
              autoIncrement: config.autoIncrement,
            });
          }
        }
      };


      request.onsuccess = () => {
        this.debugLog("IndexedDB initialized:", request.result);
        resolve(request.result);
      };


      request.onerror = () => {
        this.debugLog("IndexedDB error:", request.error);
        reject(request.error);
      };
    });
  }

  private async transaction<K extends keyof TSchema>(
    storeName: K,
    mode: IDBTransactionMode = "readonly"
  ) {
    const db = await this.dbPromise;
    const tx = db.transaction(storeName as string, mode);
    return tx.objectStore(storeName as string);
  }

  /**
   * Adds a new record to the specified object store.
   * @param storeName The name of the object store.
   * @param value The value to add to the store.
   * @returns The key of the newly added record.
   */
  async add<K extends keyof TSchema>(storeName: K, value: TSchema[K]): Promise<IDBValidKey> {
    const store = await this.transaction(storeName, "readwrite");
    return new Promise((resolve, reject) => {
      const request = store.add(value);
      request.onsuccess = () => {
        this.notify(storeName);
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Retrieves a record by key from the specified object store.
   * @param storeName The name of the object store.
   * @param key The key of the record to retrieve.
   * @returns The record if found, otherwise undefined.
   */
  async get<K extends keyof TSchema>(storeName: K, key: IDBValidKey): Promise<TSchema[K] | undefined> {
    const store = await this.transaction(storeName);
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Retrieves all records from the specified object store.
   * @param storeName The name of the object store.
   * @returns An array of all records in the store.
   */
  async getAll<K extends keyof TSchema>(storeName: K): Promise<TSchema[K][]> {
    const store = await this.transaction(storeName);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Updates an existing record in the specified object store.
   * @param storeName The name of the object store.
   * @param value The value to update in the store.
   * @returns The key of the updated record.
   */
  async update<K extends keyof TSchema>(storeName: K, value: TSchema[K]): Promise<IDBValidKey> {
    const store = await this.transaction(storeName, "readwrite");
    return new Promise((resolve, reject) => {
      const request = store.put(value);
      request.onsuccess = () => {
        this.notify(storeName);
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Deletes a record by key from the specified object store.
   * @param storeName The name of the object store.
   * @param key The key of the record to delete.
   * @returns A promise that resolves when the record is deleted.
   */
  async delete<K extends keyof TSchema>(storeName: K, key: IDBValidKey): Promise<void> {
    const store = await this.transaction(storeName, "readwrite");
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => {
        this.notify(storeName);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clears all records from the specified object store.
   * @param storeName The name of the object store.
   * @returns A promise that resolves when the store is cleared.
   */
  async clear<K extends keyof TSchema>(storeName: K): Promise<void> {
    const store = await this.transaction(storeName, "readwrite");
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => {
        this.notify(storeName);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Subscribes to changes in the specified object store.
   * @param storeName The name of the object store.
   * @param callback The function to call when the store changes.
   */
  subscribe<K extends keyof TSchema>(storeName: K, callback: Subscriber<TSchema[K]>) {
    if (!this.subscribers[storeName as string]) {
      this.subscribers[storeName as string] = [];
    }
    this.subscribers[storeName as string].push(callback);

    this.getAll(storeName).then(callback);
  }

  private async notify<K extends keyof TSchema>(storeName: K) {
    const data = await this.getAll(storeName);
    this.subscribers[storeName as string]?.forEach((cb) => cb(data));
  }

  /**
   * Get records by a secondary index
   */
  /**
   * Retrieves records by a secondary index from the specified object store.
   * @param storeName The name of the object store.
   * @param indexName The name of the index to query.
   * @param query The key or key range to search for.
   * @returns An array of matching records.
   */
  async getByIndex<K extends keyof TSchema>(storeName: K, indexName: string, query: IDBValidKey | IDBKeyRange): Promise<TSchema[K][]> {
    const store = await this.transaction(storeName);
    return new Promise((resolve, reject) => {
      const index = store.index(indexName);
      const request = index.getAll(query);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Count records in a store
   */
  /**
   * Counts the number of records in the specified object store.
   * @param storeName The name of the object store.
   * @returns The number of records in the store.
   */
  async count<K extends keyof TSchema>(storeName: K): Promise<number> {
    const store = await this.transaction(storeName);
    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Add multiple records in a single transaction
   */
  /**
   * Adds multiple records to the specified object store in a single transaction.
   * @param storeName The name of the object store.
   * @param values The array of values to add.
   * @returns An array of keys for the newly added records.
   */
  async bulkAdd<K extends keyof TSchema>(storeName: K, values: TSchema[K][]): Promise<IDBValidKey[]> {
    const store = await this.transaction(storeName, "readwrite");
    return Promise.all(values.map(value => new Promise<IDBValidKey>((resolve, reject) => {
      const request = store.add(value);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }))).then(results => {
      this.notify(storeName);
      return results;
    });
  }

  /**
   * Update multiple records in a single transaction
   */
  /**
   * Updates multiple records in the specified object store in a single transaction.
   * @param storeName The name of the object store.
   * @param values The array of values to update.
   * @returns An array of keys for the updated records.
   */
  async bulkUpdate<K extends keyof TSchema>(storeName: K, values: TSchema[K][]): Promise<IDBValidKey[]> {
    const store = await this.transaction(storeName, "readwrite");
    return Promise.all(values.map(value => new Promise<IDBValidKey>((resolve, reject) => {
      const request = store.put(value);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }))).then(results => {
      this.notify(storeName);
      return results;
    });
  }

  /**
   * Check if a key exists in a store
   */
  /**
   * Checks if a key exists in the specified object store.
   * @param storeName The name of the object store.
   * @param key The key to check for existence.
   * @returns True if the key exists, otherwise false.
   */
  async exists<K extends keyof TSchema>(storeName: K, key: IDBValidKey): Promise<boolean> {
    const store = await this.transaction(storeName);
    return new Promise((resolve, reject) => {
      const request = store.getKey(key);
      request.onsuccess = () => resolve(request.result !== undefined);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Unsubscribe from store changes
   */
  /**
   * Unsubscribes a callback from changes in the specified object store.
   * @param storeName The name of the object store.
   * @param callback The callback to remove from the subscribers list.
   */
  unsubscribe<K extends keyof TSchema>(storeName: K, callback: Subscriber<TSchema[K]>) {
    const arr = this.subscribers[storeName as string];
    if (!arr) return;
    const idx = arr.indexOf(callback);
    if (idx !== -1) arr.splice(idx, 1);
  }

  /**
   * Close the database connection
   */
  /**
   * Closes the database connection.
   * @returns A promise that resolves when the connection is closed.
   */
  async close(): Promise<void> {
    const db = await this.dbPromise;
    db.close();
  }

  /**
   * Delete the entire database
   */
  /**
   * Deletes the entire database.
   * @returns A promise that resolves when the database is deleted.
   */
  async deleteDatabase(): Promise<void> {
    await this.close();
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(this.dbName);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Delete blocked"));
    });
  }

  /**
   * Iterate over records using a cursor
   */
  /**
   * Iterates over all records in the specified object store using a cursor.
   * @param storeName The name of the object store.
   * @param callback The function to call for each record, receiving the value and key.
   * @returns A promise that resolves when iteration is complete.
   */
  async iterate<K extends keyof TSchema>(storeName: K, callback: (value: TSchema[K], key: IDBValidKey) => void): Promise<void> {
    const store = await this.transaction(storeName);
    return new Promise((resolve, reject) => {
      const request = store.openCursor();
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          callback(cursor.value, cursor.key);
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
}
