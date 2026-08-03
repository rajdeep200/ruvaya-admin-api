import { handleError, ok } from "@/lib/http/api";
import { requireAccount, getMyOrder } from "@/modules/customerAuth/service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAccount(request);
    return ok(await getMyOrder(account.id, (await params).id));
  } catch (error) {
    return handleError(error);
  }
}
