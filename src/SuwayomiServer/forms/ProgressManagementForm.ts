import { Form, type FormSectionElement } from "@paperback/types";

export class ProgressManagementForm extends Form {
  override getSections(): FormSectionElement<unknown>[] {
    return [];
  }
}
