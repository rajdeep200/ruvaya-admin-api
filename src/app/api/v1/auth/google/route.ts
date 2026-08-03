import { handleError, ok, parseJson } from "@/lib/http/api";
import { loginWithGoogle } from "@/modules/customerAuth/service";
import { googleLoginSchema } from "@/modules/customerAuth/schemas";

export async function POST(request: Request) {
  try {
    const input = googleLoginSchema.parse(await parseJson(request));
    return ok(await loginWithGoogle(input.idToken));
  } catch (error) {
    return handleError(error);
  }
}
