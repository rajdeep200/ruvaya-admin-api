import { handleError, ok, parseJson } from "@/lib/http/api";
import { requestPasswordReset } from "@/modules/customerAuth/service";
import { passwordResetRequestSchema } from "@/modules/customerAuth/schemas";

export async function POST(request: Request) {
  try {
    const { email } = passwordResetRequestSchema.parse(await parseJson(request));
    const developmentToken = await requestPasswordReset(email);
    return ok({
      accepted: true,
      message: "If the account exists, a reset email will be sent.",
      ...(developmentToken ? { developmentToken } : {}),
    });
  } catch (error) {
    return handleError(error);
  }
}
