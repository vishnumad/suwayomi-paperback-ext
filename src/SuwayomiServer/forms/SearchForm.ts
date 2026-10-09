import { AdvancedSearchForm, Section, SelectRow, type FormSectionElement } from "@paperback/types";

import {
  SearchStatusItems,
  type SearchableSource,
  type SearchQueryMetadata,
  type SearchScope,
} from "../features/search/data";
import type { ResultOf } from "../network/graphql";
import type { AvailableCategoriesFragment } from "../shared/category";
import { localStore, LocalStoreKeys } from "../util/storage";
import { state, type StateType } from "./state";

type Category = ResultOf<typeof AvailableCategoriesFragment>["categories"]["nodes"][number];

export class SearchForm extends AdvancedSearchForm {
  private scope: StateType<string[]>;
  private categoryIds: StateType<string[]>;
  private statuses: StateType<string[]>;
  private sourceIds: StateType<string[]>;

  constructor(
    metadata: SearchQueryMetadata,
    private categories: Category[],
    private sources: SearchableSource[],
  ) {
    super();

    this.scope = state<string[]>({
      initialValue: [metadata.scope],
      onChange: () => {
        this.reloadForm();
      },
    });
    this.categoryIds = state({
      initialValue: metadata.categoryIds.filter((id) =>
        categories.some((category) => category.id.toString() === id),
      ),
    });
    this.statuses = state({ initialValue: metadata.statuses });
    this.sourceIds = state({
      initialValue: metadata.sourceIds.filter((id) => sources.some((source) => source.id === id)),
    });
  }

  private get currentScope(): SearchScope {
    return this.scope.value[0] === "sources" ? "sources" : "library";
  }

  scopeSection() {
    return Section("search-scope", [
      SelectRow("search-scope-select", {
        title: "Search In",
        layout: "list",
        items: [
          { id: "library", title: "Library" },
          { id: "sources", title: "Sources" },
        ],
        value: this.scope.value,
        onValueChange: this.scope.selector,
        minItemCount: 1,
        maxItemCount: 1,
      }),
    ]);
  }

  libraryFiltersSection() {
    return Section(
      {
        id: "search-library-filters",
        header: "Library Filters",
      },
      [
        SelectRow("search-category-select", {
          title: "Categories",
          layout: "list",
          items: this.categories.map((category) => ({
            id: category.id.toString(),
            title: category.name,
          })),
          value: this.categoryIds.value,
          onValueChange: this.categoryIds.selector,
          minItemCount: 0,
          maxItemCount: this.categories.length,
        }),
        SelectRow("search-status-select", {
          title: "Status",
          layout: "list",
          items: SearchStatusItems,
          value: this.statuses.value,
          onValueChange: this.statuses.selector,
          minItemCount: 0,
          maxItemCount: SearchStatusItems.length,
        }),
      ],
    );
  }

  sourcesSection() {
    return Section(
      {
        id: "search-sources",
        header: "Sources",
      },
      [
        SelectRow("search-source-select", {
          title: "Sources",
          layout: "list",
          items: this.sources.map((source) => ({
            id: source.id,
            title: source.displayName,
          })),
          value: this.sourceIds.value,
          onValueChange: this.sourceIds.selector,
          minItemCount: 0,
          maxItemCount: this.sources.length,
        }),
      ],
    );
  }

  override getSections(): FormSectionElement<unknown>[] {
    if (this.currentScope === "sources") {
      return [this.scopeSection(), this.sourcesSection()];
    }

    return [this.scopeSection(), this.libraryFiltersSection()];
  }

  override getSearchQueryMetadata(): SearchQueryMetadata {
    return {
      scope: this.currentScope,
      categoryIds: this.categoryIds.value,
      statuses: this.statuses.value,
      sourceIds: this.sourceIds.value,
    };
  }

  override async formDidSubmit(): Promise<void> {
    if (this.currentScope === "sources") {
      if (this.sourceIds.value.length === 0) {
        throw new Error("Select at least one source to search.");
      }

      localStore.setValue(LocalStoreKeys.searchSources, this.sourceIds.value);
    }
  }
}
