import { PaperbackInterceptor, type Request, type Response } from "@paperback/types";

import { getHeader, stripHeader } from "../util/network";
import { localStore, LocalStoreKeys } from "../util/storage";
import { AUTHED_HEADER, getAuthHeaders, UNAUTHED_HEADER } from "./auth";

export class SuwayomiAuthInterceptor extends PaperbackInterceptor {
  override async interceptRequest(request: Request): Promise<Request> {
    if (getHeader(request, AUTHED_HEADER)) {
      return request;
    }

    const serverUrl = localStore.getValue(LocalStoreKeys.serverUrl);
    if (serverUrl && request.url.startsWith(serverUrl)) {
      if (getHeader(request, UNAUTHED_HEADER)) {
        // skip injecting auth headers on unauthed requests
        stripHeader(request, UNAUTHED_HEADER);
      } else {
        request.headers = {
          ...request.headers,
          ...getAuthHeaders(),
        };
      }
    }

    return request;
  }

  override async interceptResponse(
    _request: Request,
    _response: Response,
    data: ArrayBuffer,
  ): Promise<ArrayBuffer> {
    return data;
  }
}
