import type {
  ChapterReadActionQueueProcessingResult,
  Form,
  MangaProgress,
  MangaProgressProviding,
  SourceManga,
  TrackedMangaChapterReadAction,
} from "@paperback/types";

import { ProgressManagementForm } from "../../forms/ProgressManagementForm";
import { graphql } from "../../network/graphql";
import { makeGraphQLRequest } from "../../network/request";
import { formatErrors } from "../../util/error";
import { getMangaProgressData, MangaProgressFragment, MarkChaptersReadMutation } from "./data";

export class MangaProgressProvider implements MangaProgressProviding {
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
      console.error(
        `couldn't fetch progress for manga ${sourceManga.mangaId}`,
        formatErrors(errors),
      );
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
          formatErrors(errors),
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
}
