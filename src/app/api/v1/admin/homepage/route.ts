import { handleError, ok, parseJson } from "@/lib/http/api";
import { requireAdmin } from "@/modules/auth/service";
import { prisma } from "@/lib/db/prisma";
import { homepageAdminInputSchema } from "@/modules/homepage/schemas";
import { composeHomepageContent } from "@/modules/homepage/service";

export async function GET() {
  try {
    await requireAdmin("marketing.write");
    return ok(await prisma.homepageVersion.findFirst({ orderBy: { version: "desc" } }));
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin("marketing.write");
    const input = homepageAdminInputSchema.parse(await parseJson(request));
    const content = await composeHomepageContent(input);
    const latest = await prisma.homepageVersion.findFirst({ orderBy: { version: "desc" } });
    return ok(
      await prisma.homepageVersion.create({
        data: { version: (latest?.version ?? 0) + 1, content: content as object },
      }),
      201,
    );
  } catch (error) {
    return handleError(error);
  }
}
