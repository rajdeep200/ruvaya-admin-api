import { handleError, ok, parseJson } from "@/lib/http/api";
import { requireAccount, updateProfile } from "@/modules/customerAuth/service";
import { updateProfileSchema } from "@/modules/customerAuth/schemas";

export async function GET(request: Request) {
  try {
    const account = await requireAccount(request);
    return ok({ id: account.id, email: account.email, name: account.name, phone: account.phone });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const account = await requireAccount(request);
    const input = updateProfileSchema.parse(await parseJson(request));
    return ok(await updateProfile(account.id, input));
  } catch (error) {
    return handleError(error);
  }
}
