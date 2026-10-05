import { ApiError, handler, ok, requireKioskAdmin } from "@/lib/api";
import { config } from "@/lib/config";
import { addAudit, getKiosk, touchKiosk } from "@/lib/db/repo";
import { BLE_SERVICE_UUID, SLOT_SECONDS } from "@/lib/protocol";

// Tablet kiosk modunu başlatır: QR ve BLE jetonunu üretecek gizli anahtarı alır.
// Not (1. aşama): anahtar tablete düz gönderilir. 2. aşamada anahtar kioska özel ve donanım deposunda tutulmalı.
export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const claims = await requireKioskAdmin(req);
  const { id } = await ctx.params;
  const kiosk = await getKiosk(id);
  if (!kiosk || kiosk.status !== "ACTIVE") throw new ApiError(404, "Kiosk bulunamadı.", "NOT_FOUND");
  await touchKiosk(kiosk.id);
  await addAudit({ adminUserId: claims.sub, action: "KIOSK_START", entity: "kiosk", entityId: kiosk.id, beforeValue: null, afterValue: null });
  return ok({
    kiosk: { id: kiosk.id, name: kiosk.name },
    secret: kiosk.secret,
    slotSeconds: SLOT_SECONDS,
    bleServiceUuid: BLE_SERVICE_UUID,
    bleRequired: config.bleRequired,
    serverTime: Date.now(),
  });
});
