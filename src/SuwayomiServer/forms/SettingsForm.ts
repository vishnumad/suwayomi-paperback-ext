import { Form, NavigationRow, Section } from "@paperback/types";

import { ServerSettingsForm } from "./ServerSettingsForm";

export class SettingsForm extends Form {
  override getSections() {
    return [
      Section("suwayomi-settings", [
        NavigationRow("server-settings", {
          title: "Server Settings",
          form: new ServerSettingsForm(),
        }),
      ]),
    ];
  }
}
