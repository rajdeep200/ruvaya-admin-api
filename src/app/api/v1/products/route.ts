import { handleError, ok } from "@/lib/http/api";
import { paginationSchema } from "@/lib/pagination";
import { listPublicProducts, type PublicProductSort } from "@/modules/products/service";
import { productListDto } from "@/contracts/public/mappers";

const SORT_VALUES: PublicProductSort[] = ["newest", "popularity", "price_asc", "price_desc"];

function parseSort(value: string | null): PublicProductSort {
  return SORT_VALUES.includes(value as PublicProductSort) ? (value as PublicProductSort) : "newest";
}

export async function GET(request: Request) {
  try {
    const u = new URL(request.url);
    const p = paginationSchema.parse(Object.fromEntries(u.searchParams));
    const result = await listPublicProducts({
      collection: u.searchParams.get("collection") ?? undefined,
      sort: parseSort(u.searchParams.get("sort")),
      ...p,
    });
    const items = result.items.map(productListDto);
    const prices = items.map((i) => i.salePrice?.amount ?? i.price.amount);
    return ok({
      items,
      filters: {
        sizes: Array.from(new Set(result.items.flatMap((i) => i.variants.map((v) => v.size)))),
        colors: Array.from(new Map(items.flatMap((i) => i.colors).map((c) => [c.name, c])).values()),
        fabrics: Array.from(new Set(items.map((i) => i.fabric))),
        occasions: Array.from(new Set(items.flatMap((i) => i.occasion))),
        priceRange: {
          min: prices.length ? Math.min(...prices) : 0,
          max: prices.length ? Math.max(...prices) : 0,
        },
      },
      totalItems: result.totalItems,
    });
  } catch (e) {
    return handleError(e);
  }
}
