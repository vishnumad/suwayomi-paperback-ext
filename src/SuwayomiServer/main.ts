import {
  type Form,
  type SourceManga,
  type ExtensionImpl,
  type DiscoverSection,
  type DiscoverSectionItem,
  type PagedResults,
  DiscoverSectionType,
} from "@paperback/types";

import { AvailableCategoriesFragment, getAvailableSelectedCategories } from "./data/categories";
import {
  CategoryMangasFragment,
  ContinueReadingFragment,
  DiscoverSectionId,
  getCategoryMangasData,
  getContinueReadingData,
  getRecentUpdatesData,
  RecentUpdatesFragment,
} from "./data/discover";
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
        console.error(`discover ${section.id} section empty`, errors);
        return { items: [] };
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
        console.error(`discover ${section.id} section empty`, errors);
        return { items: [] };
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
        console.error(`discover ${section.id} section empty`, errors);
        return { items: [] };
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

  async getMangaDetails(_mangaId: string): Promise<SourceManga> {
    throw new Error("Method not implemented.");
  }

  async getSettingsForm(): Promise<Form> {
    return new SettingsForm();
  }
}

export const SuwayomiServer = new SuwayomiServerExtension();
