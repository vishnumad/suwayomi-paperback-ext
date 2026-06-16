import type { Request, Response } from "@paperback/types";

import { secureStore, SecureStoreKeys, LocalStoreKeys, localStore } from "../util/storage";
import { formatURL } from "../util/url";
import { getAuthHeaders } from "./auth";
import { graphql, print, type TadaDocumentNode } from "./graphql";

type GraphQLResponse<Result = unknown> = {
  data: Result | null;
  errors: Array<{ message: string }> | null;
  status: number;
};

type GraphQLRequestOptions<Result = unknown, Variables = unknown> = {
  query: TadaDocumentNode<Result, Variables>;
  variables?: Variables;
  authenticated?: boolean;
  baseURL?: string;
};

export async function makeGraphQLRequest<Result = unknown, Variables = unknown>(
  options: GraphQLRequestOptions<Result, Variables>,
) {
  const { authenticated = true } = options;

  const request = await createGraphQLRequest(options);
  const [response, data] = await Application.scheduleRequest(request);
  let parsed = parseResponseData<Result>(response, data);

  if (authenticated && isUnauthorized(parsed)) {
    const authMethod = localStore.getValue(LocalStoreKeys.authMethod);
    if (authMethod === "ui_login") {
      await attemptGraphQLTokenRefresh();

      // Retry the original request
      const retryRequest = await createGraphQLRequest(options);
      const [response, data] = await Application.scheduleRequest(retryRequest);
      parsed = parseResponseData<Result>(response, data);
    }
  }

  return parsed;
}

async function createGraphQLRequest<Result = unknown, Variables = unknown>(
  options: GraphQLRequestOptions<Result, Variables>,
) {
  const { authenticated = true, baseURL } = options;

  const storedServerURL = localStore.getValue(LocalStoreKeys.serverUrl);
  const serverURL = baseURL || storedServerURL;

  if (!serverURL) {
    const message = "ERROR: Server URL is not set.";
    throw new Error(message);
  }

  const graphqlEndpoint = `${formatURL(serverURL)}/api/graphql`;

  let requestHeaders = {
    "Content-Type": "application/json",
  };

  if (authenticated) {
    requestHeaders = {
      ...requestHeaders,
      ...getAuthHeaders(),
    };
  }

  return {
    url: graphqlEndpoint,
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify({
      query: print(options.query),
      variables: options.variables ?? {},
    }),
  } satisfies Request;
}

function isUnauthorized(response: GraphQLResponse) {
  return (
    response.status === 401 ||
    response.errors?.some((error) => error.message.includes("UnauthorizedException: Unauthorized"))
  );
}

async function attemptGraphQLTokenRefresh() {
  const storedRefreshToken = secureStore.getValue(SecureStoreKeys.refreshToken);
  const { data } = await makeGraphQLRequest({
    query: graphql(`
      mutation RefreshToken($refreshToken: String!) {
        refreshToken(input: { refreshToken: $refreshToken }) {
          accessToken
        }
      }
    `),
    variables: {
      refreshToken: storedRefreshToken ?? "",
    },
    authenticated: false,
  });

  if (data?.refreshToken.accessToken) {
    secureStore.setValue(SecureStoreKeys.accessToken, data.refreshToken.accessToken);
  }
}

function parseResponseData<Result>(response: Response, data: ArrayBuffer): GraphQLResponse<Result> {
  const parsed = JSON.parse(Application.arrayBufferToUTF8String(data) ?? "{}");
  return {
    data: parsed.data ? (parsed.data as Result) : null,
    errors: parsed.errors ? (parsed.errors as Array<{ message: string }>) : null,
    status: response.status,
  };
}
