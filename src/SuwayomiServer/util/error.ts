type GQLError = {
  message: string;
};

export function formatErrors(errors?: GQLError[] | null) {
  return errors?.map((error) => error.message).join("; ");
}
