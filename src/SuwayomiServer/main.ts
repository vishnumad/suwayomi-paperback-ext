import type { Form, SettingsFormProviding, Extension, SourceManga } from "@paperback/types";

import { SettingsForm } from "./forms/SettingsForm";

type SuwayomiServerImpl = Extension & SettingsFormProviding;

export class SuwayomiServerExtension implements SuwayomiServerImpl {
  async initialise(): Promise<void> {}

  async getMangaDetails(_mangaId: string): Promise<SourceManga> {
    throw new Error("Method not implemented.");
  }

  async getSettingsForm(): Promise<Form> {
    return new SettingsForm();
  }
}

export const SuwayomiServer = new SuwayomiServerExtension();
