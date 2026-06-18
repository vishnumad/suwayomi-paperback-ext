import type { Request } from "@paperback/types";

export function getHeader({ headers }: Request, header: string) {
  return headers?.[header] ?? headers?.[header.toLowerCase()] ?? null;
}

export function stripHeader(request: Request, header: string) {
  delete request.headers?.[header];
  delete request.headers?.[header.toLowerCase()];
}
