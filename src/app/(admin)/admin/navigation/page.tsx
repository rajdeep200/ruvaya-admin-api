import { prisma } from "@/lib/db/prisma";
import { NavigationEditor } from "@/components/admin/NavigationEditor";

export default async function NavigationPage() {
  const version = await prisma.navigationVersion.findFirst({ orderBy: { version: "desc" } });
  const content = (version?.content as { primary?: Array<{ id: string; label: string; href: string; isSale?: boolean }> } | null);
  const items = content?.primary ?? [];

  return (
    <>
      <div className="header">
        <div>
          <h1>Navigation</h1>
          <p className="muted">Controls the storefront&apos;s main menu.</p>
        </div>
      </div>
      <NavigationEditor initialItems={items} />
    </>
  );
}
