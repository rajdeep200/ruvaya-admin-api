import { handleError, ok } from "@/lib/http/api";
import { requireAccount, listMyOrders } from "@/modules/customerAuth/service";

export async function GET(request: Request) {
  try {
    const account = await requireAccount(request);
    return ok(await listMyOrders(account.id));
  } catch (error) {
    return handleError(error);
  }
}
