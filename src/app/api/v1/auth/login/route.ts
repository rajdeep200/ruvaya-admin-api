import { handleError, ok, parseJson } from "@/lib/http/api";
import { login } from "@/modules/customerAuth/service";
import { loginSchema } from "@/modules/customerAuth/schemas";

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await parseJson(request));
    return ok(await login(input.email, input.password));
  } catch (error) {
    return handleError(error);
  }
}
