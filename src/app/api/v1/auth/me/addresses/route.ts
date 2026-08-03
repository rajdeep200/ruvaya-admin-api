import { handleError, ok, parseJson } from "@/lib/http/api";
import { requireAccount } from "@/modules/customerAuth/service";
import { listAddresses, createAddress } from "@/modules/customerAuth/addresses";
import { accountAddressInputSchema } from "@/modules/customerAuth/schemas";

export async function GET(request: Request) {
  try {
    const account = await requireAccount(request);
    return ok(await listAddresses(account.id));
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const account = await requireAccount(request);
    const input = accountAddressInputSchema.parse(await parseJson(request));
    return ok(await createAddress(account.id, input), 201);
  } catch (error) {
    return handleError(error);
  }
}
