import { handleError, ok } from "@/lib/http/api";
import { logout } from "@/modules/customerAuth/service";

export async function POST(request: Request) {
  try {
    await logout(request);
    return ok({ loggedOut: true });
  } catch (error) {
    return handleError(error);
  }
}
