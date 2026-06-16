import { initGraphQLTada } from "gql.tada";

import type { introspection } from "./graphql-env";

export const graphql = initGraphQLTada<{
  introspection: introspection;
}>();

export type { ResultOf, TadaDocumentNode, VariablesOf } from "gql.tada";
export { print } from "graphql";
