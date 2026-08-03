import { handleError, ok, parseJson } from "@/lib/http/api";
import { requireAdmin } from "@/modules/auth/service";
import { variantInputSchema } from "@/modules/products/schemas";
import { createVariant } from "@/modules/products/variants";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin("catalogue.write");
    return ok(
      await createVariant(
        (await params).id,
        variantInputSchema.parse(await parseJson(request)),
        admin.id,
      ),
      201,
    );
  } catch (error) {
    return handleError(error);
  }
}
