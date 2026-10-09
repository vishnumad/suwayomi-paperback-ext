import {
  ContentRating,
  type SearchQuery,
  type SearchResultItem,
  type SortingOption,
} from "@paperback/types";

import { graphql, readFragment, type FragmentOf } from "../../network/graphql";
import { localStore, LocalStoreKeys } from "../../util/storage";
import { formatUrl } from "../../util/url";

type MangaFilterInput = ReturnType<typeof graphql.scalar<"MangaFilterInput">>;
type MangaOrderInput = ReturnType<typeof graphql.scalar<"MangaOrderInput">>;
type MangaStatus = ReturnType<typeof graphql.scalar<"MangaStatus">>;

export type SearchScope = "library" | "sources";

export type SearchQueryMetadata = {
  scope: SearchScope;
  categoryIds: string[];
  statuses: string[];
  sourceIds: string[];
};

export type SearchPageMetadata = {
  // library search
  endCursor?: string | null;
  // source search
  page?: number;
  sourceIds?: string[];
};

export function getSearchQueryMetadata(
  query: SearchQuery<Partial<SearchQueryMetadata>>,
): SearchQueryMetadata {
  return {
    scope: query.metadata?.scope ?? "library",
    categoryIds: query.metadata?.categoryIds ?? [],
    statuses: query.metadata?.statuses ?? [],
    sourceIds: query.metadata?.sourceIds ?? localStore.getValue(LocalStoreKeys.searchSources) ?? [],
  };
}

// Sorting

const SearchSortingOptions = [
  { id: "title-asc", label: "Title (A-Z)", order: [{ by: "TITLE", byType: "ASC" }] },
  { id: "title-desc", label: "Title (Z-A)", order: [{ by: "TITLE", byType: "DESC" }] },
  {
    id: "recently-added",
    label: "Recently Added",
    order: [{ by: "IN_LIBRARY_AT", byType: "DESC" }],
  },
  {
    id: "recently-refreshed",
    label: "Recently Refreshed",
    order: [{ by: "LAST_FETCHED_AT", byType: "DESC" }],
  },
] satisfies Array<SortingOption & { order: MangaOrderInput[] }>;

export function getSearchSortingOptions(): SortingOption[] {
  return SearchSortingOptions.map(({ id, label }) => ({ id, label }));
}

export function getSearchSortingOrder(sortingOption?: SortingOption): MangaOrderInput[] {
  const option = SearchSortingOptions.find(({ id }) => id === sortingOption?.id);
  return option?.order ?? [{ by: "TITLE", byType: "ASC" }];
}

// Status

export const SearchStatusItems = [
  { id: "ONGOING", title: "Ongoing" },
  { id: "COMPLETED", title: "Completed" },
  { id: "PUBLISHING_FINISHED", title: "Publishing Finished" },
  { id: "ON_HIATUS", title: "On Hiatus" },
  { id: "CANCELLED", title: "Cancelled" },
  { id: "LICENSED", title: "Licensed" },
  { id: "UNKNOWN", title: "Unknown" },
] satisfies Array<{ id: MangaStatus; title: string }>;

function isMangaStatus(status: string): status is MangaStatus {
  return SearchStatusItems.some(({ id }) => id === status);
}

// Library search

export const LibrarySearchFragment = graphql(`
  fragment LibrarySearchFragment on Query {
    librarySearchResults: mangas(filter: $filter, order: $order, first: 30, after: $after) {
      nodes {
        id
        title
        author
        artist
        thumbnailUrl
        source {
          isNsfw
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`);

export function buildLibrarySearchFilter(
  title: string,
  { categoryIds, statuses }: SearchQueryMetadata,
): MangaFilterInput {
  // Conditions must be nested under `and`, the server ignores `inLibrary` when it sits next to `or`
  const conditions: MangaFilterInput[] = [{ inLibrary: { equalTo: true } }];

  const searchTerm = title.trim();
  if (searchTerm) {
    conditions.push({
      or: [
        { title: { includesInsensitive: searchTerm } },
        { author: { includesInsensitive: searchTerm } },
        { artist: { includesInsensitive: searchTerm } },
      ],
    });
  }

  if (categoryIds.length > 0) {
    conditions.push({ categoryId: { in: categoryIds.map((id) => parseInt(id, 10)) } });
  }

  const mangaStatuses = statuses.filter(isMangaStatus);
  if (mangaStatuses.length > 0) {
    conditions.push({ status: { in: mangaStatuses } });
  }

  return { and: conditions };
}

export function getLibrarySearchData(ref: FragmentOf<typeof LibrarySearchFragment>) {
  const data = readFragment(LibrarySearchFragment, ref);
  const serverUrl = formatUrl(localStore.getValue(LocalStoreKeys.serverUrl) ?? "");

  const items: SearchResultItem[] = [];
  for (const manga of data.librarySearchResults.nodes) {
    items.push({
      mangaId: manga.id.toString(),
      title: manga.title,
      subtitle: manga.author || manga.artist || undefined,
      imageUrl: `${serverUrl}${manga.thumbnailUrl ?? ""}`,
      contentRating: manga.source?.isNsfw ? ContentRating.ADULT : ContentRating.EVERYONE,
    });
  }

  return {
    items,
    pageInfo: data.librarySearchResults.pageInfo,
  };
}

// Source search

export const SourceSearchFragment = graphql(`
  fragment SourceSearchFragment on Mutation {
    fetchSourceManga(input: { source: $sourceId, type: $type, query: $query, page: $page }) {
      hasNextPage
      mangas {
        id
        title
        thumbnailUrl
        source {
          displayName
          isNsfw
        }
      }
    }
  }
`);

export function getSourceSearchData(ref: FragmentOf<typeof SourceSearchFragment>) {
  const data = readFragment(SourceSearchFragment, ref);
  const serverUrl = formatUrl(localStore.getValue(LocalStoreKeys.serverUrl) ?? "");

  const items: SearchResultItem[] = [];
  for (const manga of data.fetchSourceManga?.mangas ?? []) {
    items.push({
      mangaId: manga.id.toString(),
      title: manga.title,
      subtitle: manga.source?.displayName,
      imageUrl: `${serverUrl}${manga.thumbnailUrl ?? ""}`,
      contentRating: manga.source?.isNsfw ? ContentRating.ADULT : ContentRating.EVERYONE,
    });
  }

  return {
    items,
    hasNextPage: data.fetchSourceManga?.hasNextPage ?? false,
  };
}

// Searchable sources

export const SearchableSourcesFragment = graphql(`
  fragment SearchableSourcesFragment on Query {
    searchableSources: sources(filter: { id: { notEqualTo: "0" } }, order: [{ by: NAME }]) {
      nodes {
        id
        displayName
      }
    }
  }
`);

export type SearchableSource = { id: string; displayName: string };

export function getSearchableSources(
  ref: FragmentOf<typeof SearchableSourcesFragment>,
): SearchableSource[] {
  const data = readFragment(SearchableSourcesFragment, ref);
  return data.searchableSources.nodes.map(({ id, displayName }) => ({ id, displayName }));
}
