import { handleError, ok, parseJson } from "@/lib/http/api";
import { signUp } from "@/modules/customerAuth/service";
import { signUpSchema } from "@/modules/customerAuth/schemas";

export async function POST(request: Request) {
  try {
    const input = signUpSchema.parse(await parseJson(request));
    return ok(await signUp(input.email, input.password, input.name), 201);
  } catch (error) {
    return handleError(error);
  }
}
