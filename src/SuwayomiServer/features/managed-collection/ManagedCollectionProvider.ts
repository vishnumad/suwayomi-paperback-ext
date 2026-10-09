import type {
  ManagedCollection,
  ManagedCollectionChangeset,
  ManagedCollectionProviding,
  SourceManga,
} from "@paperback/types";

import { graphql } from "../../network/graphql";
import { makeGraphQLRequest } from "../../network/request";
import { AvailableCategoriesFragment, getAvailableCategories } from "../../shared/category";
import { formatErrors } from "../../util/error";
import {
  AddMangasToLibraryMutation,
  AllCategoryMangasFragment,
  getAllCategoryMangasData,
  UpdateCategoriesMutation,
} from "./data";

export class ManagedCollectionProvider implements ManagedCollectionProviding {
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
      console.error(errorMessage, formatErrors(errors));
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
      console.error(errorMessage, formatErrors(errors));
      throw new Error(errorMessage);
    }

    return getAllCategoryMangasData(data);
  }

  async commitManagedCollectionChanges(changeset: ManagedCollectionChangeset): Promise<void> {
    const categoryId = parseInt(changeset.collection.id, 10);

    const addedMangas = changeset.additions.map((manga) => parseInt(manga.mangaId, 10));
    const removedMangas = changeset.deletions.map((manga) => parseInt(manga.mangaId, 10));

    if (addedMangas.length > 0) {
      // Manga found through source search aren't in the library yet
      const { errors: libraryErrors } = await makeGraphQLRequest({
        query: AddMangasToLibraryMutation,
        variables: {
          mangaIds: addedMangas,
        },
      });

      if (libraryErrors) {
        console.error(
          `commitManagedCollectionChanges: failed to add manga(s) to library`,
          formatErrors(libraryErrors),
        );
        throw new Error(`Failed to add manga(s) to collection ${changeset.collection.title}`);
      }

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
          formatErrors(errors),
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
          formatErrors(errors),
        );
        throw new Error(`Failed to remove manga(s) from collection ${changeset.collection.title}`);
      }
    }
  }
}
