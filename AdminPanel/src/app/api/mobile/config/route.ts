import { config } from "@/lib/config";
import { handler, ok } from "@/lib/api";
import { BLE_SERVICE_UUID, SLOT_SECONDS } from "@/lib/protocol";

// Mobil uygulamanın açılışta çektiği ayarlar.
export const GET = handler(async () =>
  ok({
    bleRequired: config.bleRequired,
    bleServiceUuid: BLE_SERVICE_UUID,
    slotSeconds: SLOT_SECONDS,
    duplicateWindowSeconds: config.duplicateWindowSeconds,
    serverTime: Date.now(),
  }),
);
