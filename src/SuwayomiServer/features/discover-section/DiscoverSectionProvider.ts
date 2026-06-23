import {
  DiscoverSectionType,
  type DiscoverSection,
  type DiscoverSectionItem,
  type DiscoverSectionProviding,
  type PagedResults,
} from "@paperback/types";

import { isAuthed } from "../../network/auth";
import { graphql } from "../../network/graphql";
import { makeGraphQLRequest } from "../../network/request";
import { AvailableCategoriesFragment, getAvailableSelectedCategories } from "../../shared/category";
import { formatErrors } from "../../util/error";
import { localStore, LocalStoreKeys } from "../../util/storage";
import {
  CategoryMangasFragment,
  ContinueReadingFragment,
  DiscoverSectionId,
  getCategoryMangasData,
  getContinueReadingData,
  getRecentUpdatesData,
  RecentUpdatesFragment,
} from "./data";

export class DiscoverSectionProvider implements DiscoverSectionProviding {
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
        console.error(errorMessage, formatErrors(errors));
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
        console.error(errorMessage, formatErrors(errors));
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
        console.error(errorMessage, formatErrors(errors));
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
}
