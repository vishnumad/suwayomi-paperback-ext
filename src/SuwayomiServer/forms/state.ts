import type { SelectorID } from "@paperback/types";

export type StateType<T> = {
  value: T;
  selector: SelectorID<(value: T) => Promise<void>>;
  updateValue: (value: T) => Promise<void>;
};

export function state<T>(params: {
  initialValue: T;
  onChange?: (value: T) => void | Promise<void>;
}): StateType<T> {
  let stateValue = params.initialValue;

  return {
    get value() {
      return stateValue;
    },
    get selector() {
      return Application.Selector<StateType<T>, typeof this.updateValue>(this, "updateValue");
    },
    async updateValue(value: T) {
      if (value !== stateValue) {
        stateValue = value;
        await params.onChange?.(value);
      }
    },
  };
}
