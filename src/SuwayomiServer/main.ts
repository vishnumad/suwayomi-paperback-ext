import {
  type Form,
  type SourceManga,
  type ExtensionImpl,
  type Chapter,
  type ChapterDetails,
  type ChapterReadActionQueueProcessingResult,
  type MangaProgress,
  type TrackedMangaChapterReadAction,
  type ManagedCollection,
  type ManagedCollectionChangeset,
  type DiscoverSection,
  type DiscoverSectionItem,
  type PagedResults,
  type SearchQuery,
  type SearchResultItem,
  type SortingOption,
  type AdvancedSearchForm,
} from "@paperback/types";

import { ChapterProvider } from "./features/chapter/ChapterProvider";
import { DiscoverSectionProvider } from "./features/discover-section/DiscoverSectionProvider";
import { ManagedCollectionProvider } from "./features/managed-collection/ManagedCollectionProvider";
import { MangaProgressProvider } from "./features/manga-progress/MangaProgressProvider";
import type { SearchPageMetadata, SearchQueryMetadata } from "./features/search/data";
import { SearchProvider } from "./features/search/SearchProvider";
import { SettingsForm } from "./forms/SettingsForm";
import { SuwayomiAuthInterceptor } from "./network/interceptor";
import Config from "./pbconfig";

export class SuwayomiServerExtension implements ExtensionImpl<typeof Config> {
  private interceptor = new SuwayomiAuthInterceptor("auth");

  private discoverSectionProvider = new DiscoverSectionProvider();
  private chapterProvider = new ChapterProvider();
  private mangaProgressProvider = new MangaProgressProvider();
  private managedCollectionProvider = new ManagedCollectionProvider();
  private searchProvider = new SearchProvider();

  async initialise(): Promise<void> {
    this.interceptor.registerInterceptor();
  }

  async getDiscoverSections() {
    return this.discoverSectionProvider.getDiscoverSections();
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata?: { endCursor?: string | null },
  ): Promise<PagedResults<DiscoverSectionItem>> {
    return this.discoverSectionProvider.getDiscoverSectionItems(section, metadata);
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    return this.chapterProvider.getMangaDetails(mangaId);
  }

  async getChapters(sourceManga: SourceManga, sinceDate?: Date): Promise<Chapter[]> {
    return this.chapterProvider.getChapters(sourceManga, sinceDate);
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    return this.chapterProvider.getChapterDetails(chapter);
  }

  async getMangaProgressManagementForm(sourceManga: SourceManga): Promise<Form> {
    return this.mangaProgressProvider.getMangaProgressManagementForm(sourceManga);
  }

  async getMangaProgress(sourceManga: SourceManga): Promise<MangaProgress | undefined> {
    return this.mangaProgressProvider.getMangaProgress(sourceManga);
  }

  async processChapterReadActionQueue(
    actions: TrackedMangaChapterReadAction[],
  ): Promise<ChapterReadActionQueueProcessingResult> {
    return this.mangaProgressProvider.processChapterReadActionQueue(actions);
  }

  async getManagedLibraryCollections(): Promise<ManagedCollection[]> {
    return this.managedCollectionProvider.getManagedLibraryCollections();
  }

  async getSourceMangaInManagedCollection(
    managedCollection: ManagedCollection,
  ): Promise<SourceManga[]> {
    return this.managedCollectionProvider.getSourceMangaInManagedCollection(managedCollection);
  }

  async commitManagedCollectionChanges(changeset: ManagedCollectionChangeset): Promise<void> {
    return this.managedCollectionProvider.commitManagedCollectionChanges(changeset);
  }

  async getSearchResults(
    query: SearchQuery<Partial<SearchQueryMetadata>>,
    metadata: SearchPageMetadata | undefined,
    sortingOption: SortingOption | undefined,
  ): Promise<PagedResults<SearchResultItem>> {
    return this.searchProvider.getSearchResults(query, metadata, sortingOption);
  }

  async getSortingOptions(
    query: SearchQuery<Partial<SearchQueryMetadata>>,
  ): Promise<SortingOption[]> {
    return this.searchProvider.getSortingOptions(query);
  }

  async getAdvancedSearchForm(
    query: SearchQuery<Partial<SearchQueryMetadata>>,
  ): Promise<AdvancedSearchForm> {
    return this.searchProvider.getAdvancedSearchForm(query);
  }

  async getSettingsForm(): Promise<Form> {
    return new SettingsForm();
  }
}

export const SuwayomiServer = new SuwayomiServerExtension();
