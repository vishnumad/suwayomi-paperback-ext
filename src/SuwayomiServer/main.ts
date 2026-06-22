import {
  type Form,
  type SourceManga,
  type ExtensionImpl,
  type DiscoverSection,
  type DiscoverSectionItem,
  type PagedResults,
  DiscoverSectionType,
  type Chapter,
  type ChapterDetails,
  type ChapterReadActionQueueProcessingResult,
  type MangaProgress,
  type TrackedMangaChapterReadAction,
  type ManagedCollection,
  type ManagedCollectionChangeset,
} from "@paperback/types";

import {
  AllCategoryMangasFragment,
  AvailableCategoriesFragment,
  getAllCategoryMangasData,
  getAvailableCategories,
  getAvailableSelectedCategories,
  UpdateCategoriesMutation,
} from "./data/categories";
import {
  ChapterDetailsFragment,
  ChaptersFragment,
  getChapterDetailsData,
  getChaptersData,
} from "./data/chapters";
import {
  CategoryMangasFragment,
  ContinueReadingFragment,
  DiscoverSectionId,
  getCategoryMangasData,
  getContinueReadingData,
  getRecentUpdatesData,
  RecentUpdatesFragment,
} from "./data/discover";
import { getMangaDetailsData, MangaDetailsFragment } from "./data/manga-details";
import {
  getMangaProgressData,
  MangaProgressFragment,
  MarkChaptersReadMutation,
} from "./data/manga-progress";
import { ProgressManagementForm } from "./forms/ProgressManagementForm";
import { SettingsForm } from "./forms/SettingsForm";
import { isAuthed } from "./network/auth";
import { graphql } from "./network/graphql";
import { SuwayomiAuthInterceptor } from "./network/interceptor";
import { makeGraphQLRequest } from "./network/request";
import Config from "./pbconfig";
import { localStore, LocalStoreKeys } from "./util/storage";

export class SuwayomiServerExtension implements ExtensionImpl<typeof Config> {
  private interceptor = new SuwayomiAuthInterceptor("auth");

  async initialise(): Promise<void> {
    this.interceptor.registerInterceptor();
  }

  async getDiscoverSections(): Promise<DiscoverSection[]> {
    const emptyPlaceholder = {
      id: "empty-section",
      title: "Nothing to see here...",
      subtitle: "Pull to refresh and try again.",
      type: DiscoverSectionType.simpleCarousel,
    };

    if (!isAuthed()) {
      return [emptyPlaceholder];
    }

    const sections: DiscoverSection[] = [];

    const isContinueReadingEnabled =
      localStore.getValue(LocalStoreKeys.discoverShowContinue) ?? true;
    const isRecentUpdatesEnabled = localStore.getValue(LocalStoreKeys.discoverShowUpdates) ?? true;

    if (isContinueReadingEnabled) {
      sections.push({
        id: DiscoverSectionId.continueReading,
        title: "Continue Reading",
        type: DiscoverSectionType.prominentCarousel,
      });
    }

    if (isRecentUpdatesEnabled) {
      sections.push({
        id: DiscoverSectionId.recentUpdates,
        title: "Recent Updates",
        type: DiscoverSectionType.chapterUpdates,
      });
    }

    const { data } = await makeGraphQLRequest({
      query: graphql(
        `
          query DiscoverSectionsQuery {
            ...AvailableCategoriesFragment
          }
        `,
        [AvailableCategoriesFragment],
      ),
    });

    if (data) {
      const selectedCategories = localStore.getValue(LocalStoreKeys.visibleCategories) ?? [];
      const categories = getAvailableSelectedCategories(data, selectedCategories);

      for (const category of categories) {
        sections.push({
          id: `category-${category.id}`,
          title: category.name,
          type: DiscoverSectionType.simpleCarousel,
        });
      }
    }

    // Show placeholder if empty
    if (sections.length === 0) {
      sections.push(emptyPlaceholder);
    }

    return sections;
  }

  async getDiscoverSectionItems(
    section: DiscoverSection,
    metadata?: { endCursor?: string | null },
  ): Promise<PagedResults<DiscoverSectionItem>> {
    if (section.id === DiscoverSectionId.continueReading) {
      const { data, errors } = await makeGraphQLRequest({
        query: graphql(
          `
            query ContinueReadingQuery {
              ...ContinueReadingFragment
            }
          `,
          [ContinueReadingFragment],
        ),
      });

      if (!data || errors) {
        const errorMessage = `couldn't fetch reading history for section ${section.id}`;
        console.error(errorMessage, errors);
        throw new Error(errorMessage);
      }

      const items = getContinueReadingData(data);
      return { items };
    }

    if (section.id === DiscoverSectionId.recentUpdates) {
      const { data, errors } = await makeGraphQLRequest({
        query: graphql(
          `
            query RecentUpdatesQuery($after: Cursor) {
              ...RecentUpdatesFragment
            }
          `,
          [RecentUpdatesFragment],
        ),
        variables: {
          after: metadata?.endCursor,
        },
      });

      if (!data || errors) {
        const errorMessage = `couldn't fetch chapter updates for section ${section.id}`;
        console.error(errorMessage, errors);
        throw new Error(errorMessage);
      }

      const { items, pageInfo } = getRecentUpdatesData(data);
      const { endCursor, hasNextPage } = pageInfo;
      return {
        items,
        metadata: hasNextPage ? { endCursor } : undefined,
      };
    }

    if (section.id.startsWith("category-")) {
      const categoryId = section.id.replace("category-", "");
      const { data, errors } = await makeGraphQLRequest({
        query: graphql(
          `
            query CategoryMangasQuery($categoryId: Int!, $after: Cursor) {
              ...CategoryMangasFragment
            }
          `,
          [CategoryMangasFragment],
        ),
        variables: {
          after: metadata?.endCursor,
          categoryId: parseInt(categoryId, 10),
        },
      });

      if (!data || errors) {
        const errorMessage = `couldn't fetch mangas for category ${section.id}`;
        console.error(errorMessage, errors);
        throw new Error(errorMessage);
      }

      const { items, pageInfo } = getCategoryMangasData(data);
      const { endCursor, hasNextPage } = pageInfo;
      return {
        items,
        metadata: hasNextPage ? { endCursor } : undefined,
      };
    }

    return {
      items: [],
    };
  }

  async getMangaDetails(mangaId: string): Promise<SourceManga> {
    const { data, errors } = await makeGraphQLRequest({
      query: graphql(
        `
          query MangaDetailsQuery($mangaId: Int!) {
            ...MangaDetailsFragment
          }
        `,
        [MangaDetailsFragment],
      ),
      variables: {
        mangaId: parseInt(mangaId, 10),
      },
    });

    if (!data || errors) {
      const errorMessage = `couldn't fetch manga details for manga ${mangaId}`;
      console.error(errorMessage, errors);
      throw new Error(errorMessage);
    }

    return getMangaDetailsData(data);
  }

  async getChapters(sourceManga: SourceManga, sinceDate?: Date): Promise<Chapter[]> {
    const { data, errors } = await makeGraphQLRequest({
      query: graphql(
        `
          query ChaptersQuery($mangaId: Int!, $sinceDate: LongString, $isRead: Boolean) {
            ...ChaptersFragment
          }
        `,
        [ChaptersFragment],
      ),
      variables: {
        mangaId: parseInt(sourceManga.mangaId, 10),
        sinceDate: sinceDate ? sinceDate.getTime().toString() : null,
      },
    });

    if (!data || errors) {
      const errorMessage = `couldn't fetch chapters for manga ${sourceManga.mangaId}`;
      console.error(errorMessage, errors);
      throw new Error(errorMessage);
    }

    return getChaptersData(data, sourceManga);
  }

  async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
    const { data, errors } = await makeGraphQLRequest({
      query: graphql(
        `
          mutation ChapterDetailsMutation($chapterId: Int!) {
            ...ChapterDetailsFragment
          }
        `,
        [ChapterDetailsFragment],
      ),
      variables: {
        chapterId: parseInt(chapter.chapterId, 10),
      },
    });

    if (!data || errors) {
      const errorMessage = `couldn't fetch chapter details for chapter ${chapter.chapterId}`;
      console.error(errorMessage, errors);
      throw new Error(errorMessage);
    }

    return getChapterDetailsData(data);
  }

  async getMangaProgressManagementForm(_sourceManga: SourceManga): Promise<Form> {
    return new ProgressManagementForm();
  }

  async getMangaProgress(sourceManga: SourceManga): Promise<MangaProgress | undefined> {
    const { data, errors } = await makeGraphQLRequest({
      query: graphql(
        `
          query MangaProgressQuery($mangaId: Int!) {
            ...MangaProgressFragment
          }
        `,
        [MangaProgressFragment],
      ),
      variables: {
        mangaId: parseInt(sourceManga.mangaId, 10),
      },
    });

    if (!data || errors) {
      console.error(`couldn't fetch progress for manga ${sourceManga.mangaId}`, errors);
      return undefined;
    }

    const progress = getMangaProgressData(data, sourceManga);
    if (!progress) {
      return undefined;
    }

    return {
      sourceManga,
      lastReadChapter: progress.lastReadChapter,
      lastReadTime: progress.lastReadTime,
    };
  }

  async processChapterReadActionQueue(
    actions: TrackedMangaChapterReadAction[],
  ): Promise<ChapterReadActionQueueProcessingResult> {
    const successfulItems: string[] = [];
    const failedItems: string[] = [];

    const actionsByMangaId = new Map<string, TrackedMangaChapterReadAction[]>();
    for (const action of actions) {
      const mangaId = action.chapterMangaId;
      if (!actionsByMangaId.has(mangaId)) {
        actionsByMangaId.set(mangaId, []);
      }
      actionsByMangaId.get(mangaId)!.push(action);
    }

    for (const [mangaId, readActions] of actionsByMangaId.entries()) {
      const mangaTitle = readActions[0]?.sourceManga.mangaInfo.primaryTitle || "Unknown";

      const actionIds = readActions.map((action) => action.id);
      const chapterIds = readActions.map((action) => parseInt(action.chapterId, 10));

      const { errors } = await makeGraphQLRequest({
        query: MarkChaptersReadMutation,
        variables: {
          chapterIds,
          mangaId: parseInt(mangaId, 10),
        },
      });

      if (errors) {
        console.error(
          `processChapterReadActionQueue: failed to mark chapter(s) for ${mangaId} (${mangaTitle}) as read.`,
          errors,
        );
        failedItems.push(...actionIds);
      } else {
        console.log(
          `processChapterReadActionQueue: marked ${actionIds.length} chapter(s) for ${mangaId} (${mangaTitle}) as read.`,
        );
        successfulItems.push(...actionIds);
      }
    }

    return {
      successfulItems,
      failedItems,
    };
  }

  async getManagedLibraryCollections(): Promise<ManagedCollection[]> {
    const { data, errors } = await makeGraphQLRequest({
      query: graphql(
        `
          query ManagedLibraryCollectionsQuery {
            ...AvailableCategoriesFragment
          }
        `,
        [AvailableCategoriesFragment],
      ),
    });

    if (!data || errors) {
      const errorMessage = `couldn't fetch available categories`;
      console.error(errorMessage, errors);
      throw new Error(errorMessage);
    }

    const categories = getAvailableCategories(data);
    return categories.map((category) => {
      return {
        id: category.id.toString(),
        title: category.name,
      };
    });
  }

  async commitManagedCollectionChanges(changeset: ManagedCollectionChangeset): Promise<void> {
    const categoryId = parseInt(changeset.collection.id, 10);

    const addedMangas = changeset.additions.map((manga) => parseInt(manga.mangaId, 10));
    const removedMangas = changeset.deletions.map((manga) => parseInt(manga.mangaId, 10));

    if (addedMangas.length > 0) {
      const { errors } = await makeGraphQLRequest({
        query: UpdateCategoriesMutation,
        variables: {
          mangaIds: addedMangas,
          addToCategories: [categoryId],
          removeFromCategories: [],
        },
      });

      if (errors) {
        console.error(
          `commitManagedCollectionChanges: failed to add manga(s) to category ${categoryId}`,
          errors,
        );
        throw new Error(`Failed to add manga(s) to collection ${changeset.collection.title}`);
      }
    }

    if (removedMangas.length > 0) {
      const { errors } = await makeGraphQLRequest({
        query: UpdateCategoriesMutation,
        variables: {
          mangaIds: removedMangas,
          addToCategories: [],
          removeFromCategories: [categoryId],
        },
      });

      if (errors) {
        console.error(
          `commitManagedCollectionChanges: failed to remove manga(s) from category ${categoryId}`,
          errors,
        );
        throw new Error(`Failed to remove manga(s) from collection ${changeset.collection.title}`);
      }
    }
  }

  async getSourceMangaInManagedCollection(
    managedCollection: ManagedCollection,
  ): Promise<SourceManga[]> {
    const { data, errors } = await makeGraphQLRequest({
      query: graphql(
        `
          query SourceMangaInManagedCollectionQuery($categoryId: Int!) {
            ...AllCategoryMangasFragment
          }
        `,
        [AllCategoryMangasFragment],
      ),
      variables: {
        categoryId: parseInt(managedCollection.id, 10),
      },
    });

    if (!data || errors) {
      const errorMessage = `couldn't fetch manga in category ${managedCollection.id}`;
      console.error(errorMessage, errors);
      throw new Error(errorMessage);
    }

    const mangas = getAllCategoryMangasData(data);
    return mangas;
  }

  async getSettingsForm(): Promise<Form> {
    return new SettingsForm();
  }
}

export const SuwayomiServer = new SuwayomiServerExtension();
