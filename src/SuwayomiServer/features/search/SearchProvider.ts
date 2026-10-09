import type {
  AdvancedSearchForm,
  MangaProviding,
  PagedResults,
  SearchQuery,
  SearchResultItem,
  SearchResultsProviding,
  SortingOption,
} from "@paperback/types";

import { SearchForm } from "../../forms/SearchForm";
import { isAuthed } from "../../network/auth";
import { graphql } from "../../network/graphql";
import { makeGraphQLRequest } from "../../network/request";
import { AvailableCategoriesFragment, getAvailableCategories } from "../../shared/category";
import { formatErrors } from "../../util/error";
import {
  buildLibrarySearchFilter,
  getLibrarySearchData,
  getSearchableSources,
  getSearchQueryMetadata,
  getSearchSortingOptions,
  getSearchSortingOrder,
  getSourceSearchData,
  LibrarySearchFragment,
  SearchableSourcesFragment,
  SourceSearchFragment,
  type SearchPageMetadata,
  type SearchQueryMetadata,
} from "./data";

export class SearchProvider implements Omit<SearchResultsProviding, keyof MangaProviding> {
  async getSearchResults(
    query: SearchQuery<Partial<SearchQueryMetadata>>,
    metadata: SearchPageMetadata | undefined,
    sortingOption: SortingOption | undefined,
  ): Promise<PagedResults<SearchResultItem>> {
    if (!isAuthed()) {
      return { items: [] };
    }

    const searchMetadata = getSearchQueryMetadata(query);
    if (searchMetadata.scope === "sources") {
      return this.getSourceSearchResults(query.title, searchMetadata, metadata);
    }

    return this.getLibrarySearchResults(query.title, searchMetadata, metadata, sortingOption);
  }

  async getSortingOptions(
    query: SearchQuery<Partial<SearchQueryMetadata>>,
  ): Promise<SortingOption[]> {
    // Source results are returned in each source's own order
    if (getSearchQueryMetadata(query).scope === "sources") {
      return [];
    }

    return getSearchSortingOptions();
  }

  async getAdvancedSearchForm(
    query: SearchQuery<Partial<SearchQueryMetadata>>,
  ): Promise<AdvancedSearchForm> {
    const { data, errors } = await makeGraphQLRequest({
      query: graphql(
        `
          query SearchFormDataQuery {
            ...AvailableCategoriesFragment
            ...SearchableSourcesFragment
          }
        `,
        [AvailableCategoriesFragment, SearchableSourcesFragment],
      ),
    });

    if (!data || errors) {
      const errorMessage = `couldn't fetch categories and sources for advanced search`;
      console.error(errorMessage, formatErrors(errors));
      throw new Error(errorMessage);
    }

    return new SearchForm(
      getSearchQueryMetadata(query),
      getAvailableCategories(data),
      getSearchableSources(data),
    );
  }

  private async getLibrarySearchResults(
    title: string,
    searchMetadata: SearchQueryMetadata,
    metadata: SearchPageMetadata | undefined,
    sortingOption: SortingOption | undefined,
  ): Promise<PagedResults<SearchResultItem>> {
    const { data, errors } = await makeGraphQLRequest({
      query: graphql(
        `
          query LibrarySearchQuery(
            $filter: MangaFilterInput!
            $order: [MangaOrderInput!]
            $after: Cursor
          ) {
            ...LibrarySearchFragment
          }
        `,
        [LibrarySearchFragment],
      ),
      variables: {
        filter: buildLibrarySearchFilter(title, searchMetadata),
        order: getSearchSortingOrder(sortingOption),
        after: metadata?.endCursor,
      },
    });

    if (!data || errors) {
      const errorMessage = `couldn't search library for "${title}"`;
      console.error(errorMessage, formatErrors(errors));
      throw new Error(errorMessage);
    }

    const { items, pageInfo } = getLibrarySearchData(data);
    const { endCursor, hasNextPage } = pageInfo;
    return {
      items,
      metadata: hasNextPage ? { endCursor } : undefined,
    };
  }

  private async getSourceSearchResults(
    title: string,
    searchMetadata: SearchQueryMetadata,
    metadata: SearchPageMetadata | undefined,
  ): Promise<PagedResults<SearchResultItem>> {
    const page = metadata?.page ?? 1;
    // After the first page, only search the sources that have more results
    const sourceIds = metadata?.sourceIds ?? searchMetadata.sourceIds;

    const results = await Promise.allSettled(
      sourceIds.map((sourceId) => this.searchSource(sourceId, title.trim(), page)),
    );

    if (results.length > 0 && results.every(({ status }) => status === "rejected")) {
      throw new Error("couldn't search any of the selected sources");
    }

    const items: SearchResultItem[] = [];
    const sourceIdsWithNextPage: string[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        items.push(...result.value.items);
        if (result.value.hasNextPage) {
          sourceIdsWithNextPage.push(result.value.sourceId);
        }
      }
    }

    return {
      items,
      metadata:
        sourceIdsWithNextPage.length > 0
          ? { page: page + 1, sourceIds: sourceIdsWithNextPage }
          : undefined,
    };
  }

  private async searchSource(sourceId: string, searchTerm: string, page: number) {
    const { data, errors } = await makeGraphQLRequest({
      query: graphql(
        `
          mutation SourceSearchMutation(
            $sourceId: LongString!
            $type: FetchSourceMangaType!
            $query: String
            $page: Int!
          ) {
            ...SourceSearchFragment
          }
        `,
        [SourceSearchFragment],
      ),
      variables: {
        sourceId,
        type: searchTerm ? "SEARCH" : "POPULAR",
        query: searchTerm || null,
        page,
      },
    });

    if (!data || errors) {
      const errorMessage = `couldn't search source ${sourceId}`;
      console.error(errorMessage, formatErrors(errors));
      throw new Error(errorMessage);
    }

    return {
      sourceId,
      ...getSourceSearchData(data),
    };
  }
}
