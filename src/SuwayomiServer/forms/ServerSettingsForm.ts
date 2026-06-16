import {
  ButtonRow,
  Form,
  InputRow,
  Section,
  SelectRow,
  type FormItemElement,
  type SelectRowProps,
} from "@paperback/types";

import { authOptions } from "../network/auth";
import { graphql } from "../network/graphql";
import { makeGraphQLRequest } from "../network/request";
import { localStore, LocalStoreKeys, secureStore, SecureStoreKeys } from "../util/storage";
import { state } from "./state";

export class ServerSettingsForm extends Form {
  override requiresExplicitSubmission = true;

  private serverUrlState = state({
    initialValue: localStore.getValue(LocalStoreKeys.serverUrl) ?? "",
  });

  private authMethod = state({
    initialValue: [localStore.getValue(LocalStoreKeys.authMethod) ?? "none"],
    onChange: () => this.reloadForm(),
  });

  private usernameState = state({
    initialValue: secureStore.getValue(SecureStoreKeys.username) ?? "",
  });

  private passwordState = state({
    initialValue: secureStore.getValue(SecureStoreKeys.password) ?? "",
  });

  validateServerUrl() {
    const url = this.serverUrlState.value;
    if (!url) {
      return "Server URL is required";
    }

    if (!url.startsWith("https://")) {
      return "Server URL must start with https://";
    }
  }

  isLoggedIn() {
    const [authMethod] = this.authMethod.value;
    if (authMethod === "none") return false;

    if (authMethod === "ui_login") {
      const accessToken = secureStore.getValue(SecureStoreKeys.accessToken);
      const refreshToken = secureStore.getValue(SecureStoreKeys.refreshToken);
      return !!accessToken && !!refreshToken;
    }

    if (authMethod === "basic_auth" || authMethod === "simple_login") {
      const username = secureStore.getValue(SecureStoreKeys.username);
      const password = secureStore.getValue(SecureStoreKeys.password);
      return !!username && !!password;
    }
  }

  clearLoginState() {
    secureStore.setValue(SecureStoreKeys.accessToken, null);
    secureStore.setValue(SecureStoreKeys.refreshToken, null);
    secureStore.setValue(SecureStoreKeys.username, null);
    secureStore.setValue(SecureStoreKeys.password, null);
    this.reloadForm();
  }

  serverUrlSection() {
    return Section(
      {
        id: "server-url-section",
        footer: "Your Suwayomi Server must be served over HTTPS",
      },
      [
        InputRow("server-url", {
          title: "Server URL",
          value: this.serverUrlState.value,
          onValueChange: this.serverUrlState.selector,
        }),
      ],
    );
  }

  authSection() {
    if (this.isLoggedIn()) {
      return Section("auth-section-logged-in", [
        ButtonRow("sign-out-button", {
          title: "Sign out",
          onSelect: Application.Selector(this as any, "clearLoginState"),
        }),
      ]);
    }

    const authSectionRows: FormItemElement<unknown>[] = [];
    authSectionRows.push(
      SelectRow("auth-method-select", {
        title: "Authentication Method",
        layout: "list",
        items: authOptions.map((option) => {
          let title;
          switch (option) {
            case "none":
              title = "None";
              break;
            case "basic_auth":
              title = "Basic Auth";
              break;
            case "simple_login":
              title = "Simple Login";
              break;
            case "ui_login":
              title = "UI Login";
              break;
            default:
              title = option;
          }

          return {
            id: option,
            title,
          };
        }),
        value: this.authMethod.value,
        onValueChange: this.authMethod.selector as SelectRowProps["onValueChange"],
        minItemCount: 1,
        maxItemCount: 1,
      }),
    );

    if (!this.authMethod.value.includes("none")) {
      authSectionRows.push(
        InputRow("username", {
          title: "Username",
          value: this.usernameState.value,
          onValueChange: this.usernameState.selector,
        }),
      );

      authSectionRows.push(
        InputRow("password", {
          title: "Password",
          value: this.passwordState.value,
          onValueChange: this.passwordState.selector,
          isSecureEntry: true,
        }),
      );
    }

    return Section("auth-section", authSectionRows);
  }

  override getSections() {
    return [this.serverUrlSection(), this.authSection()];
  }

  override async formDidSubmit() {
    // Validate Server URL
    const serverUrlError = this.validateServerUrl();
    if (serverUrlError) {
      throw new Error(serverUrlError);
    }

    const serverUrl = this.serverUrlState.value;
    localStore.setValue(LocalStoreKeys.serverUrl, serverUrl);

    const [authMethod] = this.authMethod.value;
    localStore.setValue(LocalStoreKeys.authMethod, authMethod ?? "none");

    const username = this.usernameState.value;
    const password = this.passwordState.value;

    if (authMethod === "ui_login") {
      const { data, errors } = await makeGraphQLRequest({
        query: graphql(`
          mutation LoginUser($username: String!, $password: String!) {
            login(input: { username: $username, password: $password }) {
              accessToken
              refreshToken
            }
          }
        `),
        variables: {
          username,
          password,
        },
        authenticated: false,
      });

      if (!data || errors) {
        throw new Error(`Failed to log in with provided credentials.`);
      }

      secureStore.setValue(SecureStoreKeys.accessToken, data.login.accessToken);
      secureStore.setValue(SecureStoreKeys.refreshToken, data.login.refreshToken);
    }

    if (authMethod === "basic_auth" || authMethod === "simple_login") {
      throw new Error(`Authentication method ${authMethod} is not implemented yet.`);
    }
  }
}
