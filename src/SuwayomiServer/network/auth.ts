import { localStore, LocalStoreKeys, secureStore, SecureStoreKeys } from "../util/storage";

export const authOptions = ["none", "basic_auth", "simple_login", "ui_login"] as const;

export type AuthMethod = (typeof authOptions)[number];

export function getAuthHeaders() {
  const authMethod = localStore.getValue(LocalStoreKeys.authMethod) ?? "none";

  switch (authMethod) {
    case "none":
      return {};
    case "basic_auth":
    case "simple_login": {
      throw new Error(`Auth method ${authMethod} is not yet implemented.`);
    }
    case "ui_login": {
      const accessToken = secureStore.getValue(SecureStoreKeys.accessToken);
      if (!accessToken) {
        throw new Error(`Login credentials not found. Try logging in again.`);
      }

      return {
        Authorization: `Bearer ${accessToken}`,
      };
    }
  }
}
