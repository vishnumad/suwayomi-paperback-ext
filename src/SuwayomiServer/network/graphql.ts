import { initGraphQLTada } from "gql.tada";

import type { introspection } from "./graphql-env";

export const graphql = initGraphQLTada<{
  introspection: introspection;
  scalars: {
    Cursor: string;
    LongString: string;
  };
}>();

export { readFragment } from "gql.tada";
export type { ResultOf, TadaDocumentNode, VariablesOf, FragmentOf } from "gql.tada";
export { print } from "graphql";
