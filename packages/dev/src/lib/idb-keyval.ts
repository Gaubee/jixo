import {createStore, del, get, set} from "idb-keyval";

export class KeyValStore<V = any> {
  private store;

  constructor(dbName: string, storeName: string = 'kv-store') {
    this.store = createStore(dbName, storeName);
  }

  async get<T = V>(key: IDBValidKey): Promise<T | undefined> {
    return get<T>(key, this.store);
  }

  async set<T = V>(key: IDBValidKey, value: T): Promise<void> {
    return set(key, value, this.store);
  }
  async del(key: IDBValidKey): Promise<void> {
    return del(key, this.store);
  }
}
