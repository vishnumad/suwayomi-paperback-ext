import { localStore, LocalStoreKeys, secureStore, SecureStoreKeys } from "../util/storage";
import { graphql } from "./graphql";
import { makeGraphQLRequest } from "./request";

export const AUTHED_HEADER = "Authorization";
export const UNAUTHED_HEADER = "X-Unauthed-Request";

export const AUTH_OPTIONS = ["none", "basic_auth", "simple_login", "ui_login"] as const;
export type AuthMethod = (typeof AUTH_OPTIONS)[number];

const RefreshTokenMutation = graphql(`
  mutation RefreshToken($refreshToken: String!) {
    refreshToken(input: { refreshToken: $refreshToken }) {
      accessToken
    }
  }
`);

export function isAuthed() {
  const serverUrl = localStore.getValue(LocalStoreKeys.serverUrl);
  if (!serverUrl) return false;

  const authMethod = localStore.getValue(LocalStoreKeys.authMethod) ?? "none";
  switch (authMethod) {
    case "none": {
      return true;
    }
    case "basic_auth": {
      const authString = secureStore.getValue(SecureStoreKeys.basicAuth);
      return Boolean(authString);
    }
    case "simple_login": {
      const errorMessage = `Auth method ${authMethod} is not supported.`;
      console.error(errorMessage);
      return false;
    }
    case "ui_login": {
      const accessToken = secureStore.getValue(SecureStoreKeys.accessToken);
      return Boolean(accessToken);
    }
  }
}

export function getAuthHeaders() {
  const authMethod = localStore.getValue(LocalStoreKeys.authMethod) ?? "none";
  switch (authMethod) {
    case "none": {
      return undefined;
    }
    case "basic_auth": {
      const authString = secureStore.getValue(SecureStoreKeys.basicAuth);
      if (!authString) {
        const errorMessage = `Login credentials not found. Try logging in again in settings.`;
        console.error(errorMessage);
        throw new Error(errorMessage);
      }

      return {
        [AUTHED_HEADER]: `Basic ${authString}`,
      };
    }
    case "simple_login": {
      const errorMessage = `Auth method ${authMethod} is not supported.`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
    case "ui_login": {
      const accessToken = secureStore.getValue(SecureStoreKeys.accessToken);
      if (!accessToken) {
        const errorMessage = `Login credentials not found. Try logging in again in settings.`;
        console.error(errorMessage);
        throw new Error(errorMessage);
      }

      return {
        [AUTHED_HEADER]: `Bearer ${accessToken}`,
      };
    }
  }
}

export async function attemptGraphQLTokenRefresh() {
  const storedRefreshToken = secureStore.getValue(SecureStoreKeys.refreshToken);
  const { data } = await makeGraphQLRequest({
    query: RefreshTokenMutation,
    variables: {
      refreshToken: storedRefreshToken ?? "",
    },
    authenticated: false,
  });

  if (data?.refreshToken.accessToken) {
    secureStore.setValue(SecureStoreKeys.accessToken, data.refreshToken.accessToken);
  }
}
