import { handler, ok, requireKioskAdmin } from "@/lib/api";
import { listKiosks } from "@/lib/db/repo";

export const GET = handler(async (req: Request) => {
  await requireKioskAdmin(req);
  const kiosks = await listKiosks();
  return ok({ kiosks: kiosks.filter((k) => k.status === "ACTIVE").map((k) => ({ id: k.id, name: k.name })) });
});
