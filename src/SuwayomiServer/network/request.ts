import type { Request, Response } from "@paperback/types";

import { LocalStoreKeys, localStore } from "../util/storage";
import { formatUrl } from "../util/url";
import { attemptGraphQLTokenRefresh, getAuthHeaders, UNAUTHED_HEADER } from "./auth";
import { print, type TadaDocumentNode } from "./graphql";

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
    const errorMessage = "Server URL is not set.";
    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  const graphqlEndpoint = `${formatUrl(serverURL)}/api/graphql`;

  let requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (authenticated) {
    requestHeaders = {
      ...requestHeaders,
      ...getAuthHeaders(),
    };
  } else {
    // mark request as unauthed so interceptor does not add auth headers
    requestHeaders = {
      ...requestHeaders,
      [UNAUTHED_HEADER]: "true",
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

function parseResponseData<Result>(response: Response, data: ArrayBuffer): GraphQLResponse<Result> {
  const parsed = JSON.parse(Application.arrayBufferToUTF8String(data) ?? "{}");
  return {
    data: parsed.data ? (parsed.data as Result) : null,
    errors: parsed.errors ? (parsed.errors as Array<{ message: string }>) : null,
    status: response.status,
  };
}
