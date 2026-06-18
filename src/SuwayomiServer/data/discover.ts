import type {
  ChapterUpdatesCarouselItem,
  ProminentCarouselItem,
  SimpleCarouselItem,
} from "@paperback/types";

import { graphql, readFragment, type FragmentOf } from "../network/graphql";
import { localStore, LocalStoreKeys } from "../util/storage";
import { formatURL } from "../util/url";

export const DiscoverSectionId = {
  continueReading: "continue-reading",
  recentUpdates: "recent-updates",
};

export const ContinueReadingFragment = graphql(`
  fragment ContinueReadingFragment on Query {
    lastReadChapters: chapters(
      order: [{ by: LAST_READ_AT, byType: DESC }, { by: SOURCE_ORDER, byType: DESC }]
      first: 50
    ) {
      nodes {
        manga {
          id
          thumbnailUrl
          title
          author
          artist
          lastReadChapter {
            id
          }
          highestNumberedChapter {
            id
          }
        }
      }
    }
  }
`);

export function getContinueReadingData(ref: FragmentOf<typeof ContinueReadingFragment>) {
  const data = readFragment(ContinueReadingFragment, ref);
  const serverUrl = formatURL(localStore.getValue(LocalStoreKeys.serverUrl) ?? "");

  const items: ProminentCarouselItem[] = [];
  for (const chapter of data.lastReadChapters.nodes) {
    const { lastReadChapter, highestNumberedChapter } = chapter.manga;
    if (
      lastReadChapter &&
      highestNumberedChapter &&
      lastReadChapter.id !== highestNumberedChapter.id
    ) {
      const manga = chapter.manga;
      if (!items.some(({ mangaId }) => mangaId === manga.id.toString())) {
        items.push({
          type: "prominentCarouselItem",
          mangaId: manga.id.toString(),
          imageUrl: `${serverUrl}${manga.thumbnailUrl}`,
          title: manga.title,
          subtitle: manga.author || manga.artist || undefined,
        });
      }
    }
  }

  return items;
}

export const RecentUpdatesFragment = graphql(`
  fragment RecentUpdatesFragment on Query {
    recentlyUpdatedChapters: chapters(
      filter: { inLibrary: { equalTo: true } }
      order: [{ by: FETCHED_AT, byType: DESC }, { by: SOURCE_ORDER, byType: DESC }]
      first: 15
      after: $after
    ) {
      nodes {
        id
        name
        isRead
        manga {
          id
          title
          thumbnailUrl
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`);

export function getRecentUpdatesData(ref: FragmentOf<typeof RecentUpdatesFragment>) {
  const data = readFragment(RecentUpdatesFragment, ref);
  const serverUrl = formatURL(localStore.getValue(LocalStoreKeys.serverUrl) ?? "");

  const items: ChapterUpdatesCarouselItem[] = [];
  const chapters = data.recentlyUpdatedChapters.nodes;
  for (const chapter of chapters) {
    items.push({
      type: "chapterUpdatesCarouselItem",
      chapterId: chapter.id.toString(),
      mangaId: chapter.manga.id.toString(),
      imageUrl: `${serverUrl}${chapter.manga.thumbnailUrl}`,
      title: chapter.manga.title,
      subtitle: `${chapter.name}${chapter.isRead ? "" : " ✨"}`,
    });
  }

  return {
    items,
    pageInfo: data.recentlyUpdatedChapters.pageInfo,
  };
}

export const CategoryMangasFragment = graphql(`
  fragment CategoryMangasFragment on Query {
    mangas(
      filter: { categoryId: { equalTo: $categoryId } }
      order: { by: TITLE, byType: ASC }
      first: 15
      after: $after
    ) {
      nodes {
        id
        thumbnailUrl
        title
        author
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`);

export function getCategoryMangasData(ref: FragmentOf<typeof CategoryMangasFragment>) {
  const data = readFragment(CategoryMangasFragment, ref);
  const serverUrl = formatURL(localStore.getValue(LocalStoreKeys.serverUrl) ?? "");

  const items: SimpleCarouselItem[] = [];
  const mangas = data.mangas.nodes;

  for (const manga of mangas) {
    items.push({
      type: "simpleCarouselItem",
      mangaId: manga.id.toString(),
      imageUrl: `${serverUrl}${manga.thumbnailUrl}`,
      title: manga.title,
      subtitle: manga.author || undefined,
    });
  }

  return {
    items,
    pageInfo: data.mangas.pageInfo,
  };
}
