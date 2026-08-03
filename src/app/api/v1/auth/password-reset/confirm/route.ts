import { handleError, ok, parseJson } from "@/lib/http/api";
import { resetPassword } from "@/modules/customerAuth/service";
import { passwordResetConfirmSchema } from "@/modules/customerAuth/schemas";

export async function POST(request: Request) {
  try {
    const input = passwordResetConfirmSchema.parse(await parseJson(request));
    await resetPassword(input.token, input.password);
    return ok({ reset: true });
  } catch (error) {
    return handleError(error);
  }
}
