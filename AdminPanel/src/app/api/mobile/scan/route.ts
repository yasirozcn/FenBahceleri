import { z } from "zod";
import { ApiError, body, handler, ok, requireStudent } from "@/lib/api";
import { formatTime } from "@/lib/sms";
import { processScan } from "@/lib/scan";

const schema = z.object({
  qr: z.string().min(10).max(300),
  ble: z.object({ token: z.string().regex(/^[0-9a-f]{16}$/), rssi: z.number().nullable() }).nullable(),
  timestamp: z.number().int(),
  signature: z.string().regex(/^[0-9a-f]{64}$/),
});

// Öğrenci kioskun QR kodunu okuttuğunda çağrılır.
export const POST = handler(async (req: Request) => {
  const claims = await requireStudent(req);
  const input = await body(req, schema);
  const result = await processScan({ studentId: claims.sub, deviceId: claims.deviceId, ...input });
  if (!result.ok) throw new ApiError(422, result.message, result.reason);
  return ok({
    eventId: result.event.id,
    direction: result.event.direction,
    occurredAt: result.event.occurredAt,
    time: formatTime(result.event.occurredAt),
    duplicate: result.duplicate,
    studentName: result.studentName,
    // null: BLE jetonu gönderilmedi; true/false: jeton bu kioskun o anki jetonuyla eşleşti mi
    bleVerified: result.bleOk,
  });
});
