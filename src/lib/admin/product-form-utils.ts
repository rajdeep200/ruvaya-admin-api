export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const rupees = (paise: number | null | undefined) =>
  paise == null ? "" : (paise / 100).toFixed(2).replace(/\.00$/, "");

export function paise(value: string, field: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim()))
    throw new Error(
      `${field} must be a positive rupee amount with at most two decimals`,
    );
  const [whole, decimal = ""] = value.split(".");
  return Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
}

