export class ApiRequestError extends Error {
  details?: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.details = details;
  }
}

export async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, init);
  const json = await response.json();
  if (!response.ok)
    throw new ApiRequestError(
      json.error?.message ?? "Request failed",
      json.error?.details,
    );
  return json.data;
}
