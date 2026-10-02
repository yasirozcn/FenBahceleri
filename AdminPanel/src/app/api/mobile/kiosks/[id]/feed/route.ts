import { handler, ok, requireKioskAdmin } from "@/lib/api";
import { listEvents, touchKiosk } from "@/lib/db/repo";
import { formatTime } from "@/lib/sms";

// Kiosk ekranı birkaç saniyede bir çağırır: son okutan öğrencileri gösterir (ve kiosk "canlı" görünür).
export const GET = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireKioskAdmin(req);
  const { id } = await ctx.params;
  const since = new URL(req.url).searchParams.get("since") ?? new Date(Date.now() - 60_000).toISOString();
  await touchKiosk(id);
  const events = await listEvents({ kioskId: id, since, limit: 5 });
  return ok({
    serverTime: Date.now(),
    events: events.map((e) => ({
      id: e.id,
      name: `${e.student.firstName} ${e.student.lastName}`,
      className: e.student.className,
      direction: e.direction,
      occurredAt: e.occurredAt,
      time: formatTime(e.occurredAt),
    })),
  });
});
