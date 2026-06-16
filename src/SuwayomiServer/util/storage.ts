import type { AuthMethod } from "../network/auth";

type Storage = {
  store: <T>(key: string, value: T | null) => void;
  retrieve: <T>(key: string) => T | null;
};

export class Store<Schema extends Record<string, unknown>> {
  constructor(private storage: Storage) {}

  setValue<K extends keyof Schema>(key: K, value: Schema[K] | null): void {
    this.storage.store(key as string, value);
  }

  getValue<K extends keyof Schema>(key: K): Schema[K] | null {
    return this.storage.retrieve<Schema[K]>(key as string) ?? null;
  }
}

// Local Store

type LocalStoreSchema = {
  "server-url": string;
  "auth-method": AuthMethod;
};

export const LocalStoreKeys = {
  serverUrl: "server-url",
  authMethod: "auth-method",
} satisfies Record<string, keyof LocalStoreSchema>;

export type LocalStore = Store<LocalStoreSchema>;

export const localStore = new Store<LocalStoreSchema>({
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
  store: (key, value) => {
    Application.setSecureState(value, key);
  },
  retrieve: (key) => {
    return Application.getSecureState(key) as any;
  },
});
