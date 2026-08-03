import { handleError, ok, parseJson } from "@/lib/http/api";
import { requireAccount } from "@/modules/customerAuth/service";
import { updateAddress, deleteAddress } from "@/modules/customerAuth/addresses";
import { accountAddressUpdateSchema } from "@/modules/customerAuth/schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAccount(request);
    const input = accountAddressUpdateSchema.parse(await parseJson(request));
    return ok(await updateAddress(account.id, (await params).id, input));
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireAccount(request);
    await deleteAddress(account.id, (await params).id);
    return ok({ deleted: true });
  } catch (error) {
    return handleError(error);
  }
}
