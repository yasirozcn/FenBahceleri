@AGENTS.md

## Claude Code için ek notlar

- Bir alt projede çalışırken o klasördeki `CLAUDE.md` / `AGENTS.md` da yüklenir; ikisini birlikte uygulayın. Çelişki olursa **alt projedeki** kural geçerlidir, ama protokol ve API sözleşmesi (kök AGENTS.md §4–§6) yalnızca iki taraf birlikte değiştirilerek değişir.
- Bir işe başlamadan önce ilgili dosyayı okuyun; özellikle `AdminPanel/src/lib/protocol.ts` ↔ `QrScannerApp/src/lib/protocol.ts`, `AdminPanel/src/lib/scan.ts`, `AdminPanel/db/schema.sql`.
- Kütüphane sürümleri eğitim verinizden yenidir (Next.js 16, Expo SDK 57, React 19). API'yi hafızadan yazmayın: Next.js için `AdminPanel/node_modules/next/dist/docs/`, Expo için https://docs.expo.dev/llms.txt.
- "Bitti" demeden önce kök AGENTS.md §9'daki komutları çalıştırın ve çıktıyı raporlayın. Test çalıştıramadıysanız bunu açıkça söyleyin.
- Gizli bilgi içeren dosyaları (`.env*`, `deploy/.env`) okumayın/göstermeyin; commit'e eklemeyin. Şifreyi komut satırına yazan bir komut önermeyin.
- Kullanıcının çalışan sunucusunu (`npm run dev`) veya yerel veritabanını bozacak işlemlerden (`db:reset`, `docker compose down -v`) önce sorun. Testleri ayrı bir veritabanında (`fenbahceleri_test`) çalıştırın.
- Commit ve push yalnızca istendiğinde.
