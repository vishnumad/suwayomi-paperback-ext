import type { Chapter, ChapterDetails, ChapterProviding, SourceManga } from "@paperback/types";

import { graphql } from "../../network/graphql";
import { makeGraphQLRequest } from "../../network/request";
import { formatErrors } from "../../util/error";
import {
  ChapterDetailsFragment,
  ChaptersFragment,
  getChapterDetailsData,
  getChaptersData,
  getMangaDetailsData,
  MangaDetailsFragment,
} from "./data";

export class ChapterProvider implements ChapterProviding {
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
      console.error(errorMessage, formatErrors(errors));
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
      console.error(errorMessage, formatErrors(errors));
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
      console.error(errorMessage, formatErrors(errors));
      throw new Error(errorMessage);
    }

    return getChapterDetailsData(data);
  }
}
