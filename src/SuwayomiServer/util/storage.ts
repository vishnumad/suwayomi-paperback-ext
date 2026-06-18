import type { AuthMethod } from "../network/auth";

type Storage = {
  inMemoryCache?: boolean;
  store: <T>(key: string, value: T | null) => void;
  retrieve: <T>(key: string) => T | null;
};

export class Store<Schema extends Record<string, unknown>> {
  private kvMap = new Map<keyof Schema, Schema[keyof Schema] | null>();

  constructor(private storage: Storage) {}

  setValue<K extends keyof Schema>(key: K, value: Schema[K] | null): void {
    this.storage.store(key as string, value);

    if (this.storage.inMemoryCache) {
      this.kvMap.set(key, value);
    }
  }

  getValue<K extends keyof Schema>(key: K): Schema[K] | null {
    if (this.storage.inMemoryCache && this.kvMap.has(key)) {
      return (this.kvMap.get(key) ?? null) as Schema[K] | null;
    }

    const storedValue = this.storage.retrieve<Schema[K]>(key as string) ?? null;
    if (this.storage.inMemoryCache) {
      this.kvMap.set(key, storedValue);
    }

    return storedValue;
  }
}

// Local Store

type LocalStoreSchema = {
  "server-url": string;
  "auth-method": AuthMethod;
  "visible-categories": string[];
  "discover-show-continue": boolean;
  "discover-show-updates": boolean;
};

export const LocalStoreKeys = {
  serverUrl: "server-url",
  authMethod: "auth-method",
  visibleCategories: "visible-categories",
  discoverShowContinue: "discover-show-continue",
  discoverShowUpdates: "discover-show-updates",
} satisfies Record<string, keyof LocalStoreSchema>;

export type LocalStore = Store<LocalStoreSchema>;

export const localStore = new Store<LocalStoreSchema>({
  inMemoryCache: true,
  store: (key, value) => {
    Application.setState(value, key);
  },
  retrieve: (key) => {
    return Application.getState(key) as any;
  },
});

// Secure Store

type SecureStoreSchema = {
  username: string;
  password: string;
  "access-token": string;
  "refresh-token": string;
};

export const SecureStoreKeys = {
  username: "username",
  password: "password",
  accessToken: "access-token",
  refreshToken: "refresh-token",
} satisfies Record<string, keyof SecureStoreSchema>;

export type SecureStore = Store<SecureStoreSchema>;

export const secureStore = new Store<SecureStoreSchema>({
  inMemoryCache: true,
  store: (key, value) => {
    Application.setSecureState(value, key);
  },
  retrieve: (key) => {
    return Application.getSecureState(key) as any;
  },
});
