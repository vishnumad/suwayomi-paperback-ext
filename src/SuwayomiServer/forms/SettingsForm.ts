import {
  Form,
  LabelRow,
  NavigationRow,
  Section,
  SelectRow,
  ToggleRow,
  type FormItemElement,
  type FormSectionElement,
} from "@paperback/types";

import {
  AvailableCategoriesFragment,
  getAvailableCategories,
  getAvailableSelectedCategories,
} from "../data/categories";
import { isAuthed } from "../network/auth";
import { graphql, type ResultOf } from "../network/graphql";
import { makeGraphQLRequest } from "../network/request";
import { localStore, LocalStoreKeys } from "../util/storage";
import { ServerSettingsForm } from "./ServerSettingsForm";
import { state } from "./state";

type Category = ResultOf<typeof AvailableCategoriesFragment>["categories"]["nodes"][number];

export class SettingsForm extends Form {
  private allCategories = state<Category[] | null>({
    initialValue: null,
    onChange: () => {
      this.reloadForm();
    },
  });

  private selectedCategories = state<string[]>({
    initialValue: localStore.getValue(LocalStoreKeys.visibleCategories) || [],
    onChange: (selected) => {
      localStore.setValue(LocalStoreKeys.visibleCategories, selected);
      Application.invalidateDiscoverSections();
    },
  });

  private showContinueReading = state({
    initialValue: localStore.getValue(LocalStoreKeys.discoverShowContinue) ?? true,
    onChange: (value) => {
      localStore.setValue(LocalStoreKeys.discoverShowContinue, value);
      Application.invalidateDiscoverSections();
    },
  });

  private showRecentUpdates = state({
    initialValue: localStore.getValue(LocalStoreKeys.discoverShowUpdates) ?? true,
    onChange: (value) => {
      localStore.setValue(LocalStoreKeys.discoverShowUpdates, value);
      Application.invalidateDiscoverSections();
    },
  });

  async fetchFormData() {
    if (!isAuthed()) return;

    const { data, errors } = await makeGraphQLRequest({
      query: graphql(
        `
          query GetSettingsFormData {
            ...AvailableCategoriesFragment
          }
        `,
        [AvailableCategoriesFragment],
      ),
    });

    if (errors || !data) {
      console.error("failed to fetch settings data:", errors);
      return;
    }

    const categories = getAvailableCategories(data);
    const availableSelectedCategories = getAvailableSelectedCategories(
      data,
      this.selectedCategories.value,
    );

    await this.selectedCategories.updateValue(availableSelectedCategories.map(({ name }) => name));
    await this.allCategories.updateValue(categories);
  }

  serverSettingsSection() {
    return Section("suwayomi-server-settings", [
      NavigationRow("server-settings", {
        title: "Server Settings",
        form: new ServerSettingsForm(),
      }),
    ]);
  }

  discoverSettingsSection() {
    const items: FormItemElement<unknown>[] = [];

    const isLoading = this.allCategories.value === null;
    if (isLoading) {
      items.push(
        LabelRow("discover-settings-loading", {
          title: "Loading...",
        }),
      );
    } else {
      items.push(
        SelectRow("category-select", {
          title: "Visible Categories",
          layout: "list",
          items: (this.allCategories.value || []).map((category) => ({
            id: category.name,
            title: category.name,
          })),
          value: this.selectedCategories.value,
          onValueChange: this.selectedCategories.selector,
          minItemCount: 0,
          maxItemCount: this.allCategories.value?.length || 0,
        }),
        ToggleRow("show-continue", {
          title: "Show Continue Reading",
          value: this.showContinueReading.value,
          onValueChange: this.showContinueReading.selector,
        }),
        ToggleRow("show-updates", {
          title: "Show Recent Updates",
          value: this.showRecentUpdates.value,
          onValueChange: this.showRecentUpdates.selector,
        }),
      );
    }

    return Section(
      {
        id: "suwayomi-discover-settings",
        header: "Discover Settings",
      },
      items,
    );
  }

  override getSections(): FormSectionElement<unknown>[] {
    const sections = [this.serverSettingsSection()];

    if (isAuthed()) {
      sections.push(this.discoverSettingsSection());
    }

    return sections;
  }

  override formWillAppear() {
    void this.fetchFormData();
  }
}
