import type { Chapter, ChapterDetails, SourceManga } from "@paperback/types";

import { graphql, readFragment, type FragmentOf } from "../network/graphql";
import { parseChapterTitle, parseChapterVolume } from "../util/chapter";
import { localStore, LocalStoreKeys } from "../util/storage";
import { formatUrl } from "../util/url";

export const ChaptersFragment = graphql(`
  fragment ChaptersFragment on Query {
    chapters(
      filter: {
        mangaId: { equalTo: $mangaId }
        uploadDate: { lessThan: $sinceDate }
        isRead: { equalTo: $isRead }
      }
      order: [{ by: SOURCE_ORDER, byType: DESC }]
    ) {
      nodes {
        id
        name
        chapterNumber
        uploadDate
        scanlator
        manga {
          source {
            lang
          }
        }
      }
    }
  }
`);

export function getChaptersData(
  ref: FragmentOf<typeof ChaptersFragment>,
  sourceManga: SourceManga,
) {
  const data = readFragment(ChaptersFragment, ref);

  const chapters: Chapter[] = [];
  for (const chapter of data.chapters.nodes) {
    chapters.push({
      chapterId: chapter.id.toString(),
      sourceManga,
      title: parseChapterTitle(chapter.name),
      volume: parseChapterVolume(chapter.name),
      langCode: chapter.manga.source?.lang ?? "en",
      chapNum: chapter.chapterNumber,
      version: chapter.scanlator ?? undefined,
      publishDate: new Date(parseInt(chapter.uploadDate, 10)),
    });
  }

  return chapters;
}

export const ChapterDetailsFragment = graphql(`
  fragment ChapterDetailsFragment on Mutation {
    fetchChapterPages(input: { chapterId: $chapterId }) {
      pages
      chapter {
        id
        mangaId
      }
    }
  }
`);

export function getChapterDetailsData(ref: FragmentOf<typeof ChapterDetailsFragment>) {
  const data = readFragment(ChapterDetailsFragment, ref);
  const details = data.fetchChapterPages;

  if (!details) {
    const errorMessage = "Failed to fetch chapter details";
    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  const serverUrl = formatUrl(localStore.getValue(LocalStoreKeys.serverUrl) ?? "");

  return {
    type: "images",
    id: details.chapter.id.toString(),
    mangaId: details.chapter.mangaId.toString(),
    pages: details.pages.map((path) => {
      return `${serverUrl}${path}`;
    }),
  } satisfies ChapterDetails;
}
