import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { FlatList, Platform, Pressable, Switch, Text, View } from "react-native";
import { Button, Card, Screen } from "@/components/ui";
import { clearBleLog, getBleLog, startBleScan, subscribeBleLog, subscribeBtState, type BleStatus, type BtState, type Found, type SeenDevice } from "@/lib/ble";
import { colors } from "@/lib/config";
import { useSession } from "@/lib/session";

// Sunucuya ulaşılamazsa kullanılan varsayılan (AdminPanel src/lib/protocol.ts → BLE_SERVICE_UUID).
const DEFAULT_SERVICE_UUID = "6f1b0000-5a1e-4c1a-9b9e-fb0000000001";

const time = (ms: number) => new Date(ms).toLocaleTimeString("tr-TR", { hour12: false });

// Bluetooth testi: tarama durumu, çevredeki cihazlar, bulunan kiosk jetonu ve ayrıntılı log.
// Aynı loglar Metro terminalinde ve Xcode konsolunda "[BLE]" önekiyle görünür.
export default function BleDebug() {
  const { config, refreshConfig } = useSession();
  const [bt, setBt] = useState<BtState | null>(null);
  const [status, setStatus] = useState<BleStatus>("scanning");
  const [latest, setLatest] = useState<Found | null>(null);
  const [devices, setDevices] = useState<SeenDevice[]>([]);
  const [log, setLog] = useState(getBleLog());
  const [verbose, setVerbose] = useState(false);
  const [tab, setTab] = useState<"devices" | "log">("devices");
  const [serviceUuid, setServiceUuid] = useState<string | null>(config?.bleServiceUuid ?? null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => subscribeBtState(setBt), []);
  useEffect(() => subscribeBleLog(() => setLog(getBleLog())), []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (serviceUuid) return;
    (async () => setServiceUuid((await refreshConfig())?.bleServiceUuid ?? DEFAULT_SERVICE_UUID))();
  }, [serviceUuid, refreshConfig]);

  useEffect(() => {
    if (!serviceUuid) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      stop = await startBleScan(
        serviceUuid,
        (s, l) => {
          setStatus(s);
          setLatest(l);
        },
        { onDevices: setDevices, verbose },
      );
      if (cancelled) stop();
    })();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [serviceUuid, verbose]);

  const age = latest ? Math.max(0, Math.round((now - latest.at) / 1000)) : null;
  const fresh = age !== null && age <= 8;

  return (
    <Screen>
      <Text style={{ fontSize: 26, fontWeight: "800", letterSpacing: -0.3, color: colors.ink }}>Bluetooth testi</Text>
      <Text style={{ fontSize: 13, color: colors.inkSoft, marginTop: 4 }}>
        {Platform.OS} · Servis {serviceUuid ?? "…"}
      </Text>

      <Card style={{ marginTop: 12, padding: 14 }}>
        <Row label="Bluetooth" value={bt ?? "…"} ok={bt === "PoweredOn"} />
        <Row label="Tarama" value={status} ok={status === "scanning" || status === "found"} />
        <Row label="Çevredeki cihaz" value={String(devices.length)} ok={devices.length > 0} />
        <Row
          label="Kiosk jetonu"
          value={latest ? `${latest.token} · ${latest.source} · RSSI ${latest.rssi ?? "?"} · ${age} sn önce` : "henüz yok"}
          ok={fresh}
        />
      </Card>

      <View style={{ flexDirection: "row", marginTop: 12, gap: 8, alignItems: "center" }}>
        <Tab title={`Cihazlar (${devices.length})`} active={tab === "devices"} onPress={() => setTab("devices")} />
        <Tab title={`Log (${log.length})`} active={tab === "log"} onPress={() => setTab("log")} />
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 12, color: colors.muted }}>Ayrıntılı</Text>
        <Switch value={verbose} onValueChange={setVerbose} />
      </View>

      <View style={{ flex: 1, marginTop: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 18, backgroundColor: colors.white, overflow: "hidden" }}>
        {tab === "devices" ? (
          <FlatList
            data={devices}
            keyExtractor={(d) => d.id}
            ListEmptyComponent={<Text style={{ padding: 12, color: colors.muted }}>Henüz cihaz bulunamadı.</Text>}
            renderItem={({ item: d }) => (
              <View style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: colors.lineSoft, backgroundColor: d.isKiosk ? colors.brandSoft : undefined }}>
                <Text style={{ fontWeight: "600", color: colors.ink }}>
                  {d.isKiosk ? "★ KIOSK · " : ""}
                  {d.name ?? "(adsız)"} <Text style={{ color: colors.muted, fontWeight: "400" }}>RSSI {d.rssi ?? "?"}</Text>
                </Text>
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  {d.id.slice(0, 18)}… · {d.count} paket · {Math.max(0, Math.round((now - d.lastSeen) / 1000))} sn önce
                  {d.services.length ? ` · servis ${d.services.join(",")}` : ""}
                  {d.hasServiceData ? " · serviceData" : ""}
                  {d.hasManufacturerData ? " · manufacturerData" : ""}
                </Text>
              </View>
            )}
          />
        ) : (
          <FlatList
            data={log.slice().reverse()}
            keyExtractor={(e, i) => `${e.at}-${i}`}
            renderItem={({ item: e }) => (
              <Text style={{ fontSize: 11, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", paddingHorizontal: 8, paddingVertical: 3, color: e.msg.startsWith("KIOSK") ? colors.brand : colors.ink }}>
                {time(e.at)} {e.msg}
              </Text>
            )}
          />
        )}
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        <Button title="Logu temizle" variant="secondary" onPress={clearBleLog} style={{ flex: 1 }} />
        <Button title="Kapat" variant="ghost" onPress={() => router.back()} style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 3 }}>
      <View style={{ width: 9, height: 9, borderRadius: 5, marginRight: 8, backgroundColor: ok ? colors.brand : colors.warn }} />
      <Text style={{ width: 110, color: colors.muted, fontSize: 13 }}>{label}</Text>
      <Text style={{ flex: 1, color: colors.ink, fontSize: 13 }}>{value}</Text>
    </View>
  );
}

function Tab({ title, active, onPress }: { title: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: active ? colors.brand : colors.brandSoft }}>
      <Text style={{ color: active ? colors.white : colors.brandDark, fontSize: 13, fontWeight: "600" }}>{title}</Text>
    </Pressable>
  );
}
