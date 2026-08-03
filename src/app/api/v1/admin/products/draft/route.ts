import { handleError, ok, parseJson } from "@/lib/http/api";
import { requireAdmin } from "@/modules/auth/service";
import { productDraftSchema } from "@/modules/products/schemas";
import { createProductDraft } from "@/modules/products/service";
export async function POST(request:Request){try{const admin=await requireAdmin("catalogue.write");return ok(await createProductDraft(productDraftSchema.parse(await parseJson(request)),admin.id),201)}catch(error){return handleError(error)}}
