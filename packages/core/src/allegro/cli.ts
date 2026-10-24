// Połączenie z Allegro:
//   npm run allegro -- polacz   → link do kliknięcia „Zezwól”
//   npm run allegro -- czekaj   → czeka na potwierdzenie i zapisuje dostęp
//   npm run allegro -- test     → sprawdza połączenie (login konta)
import { allegroApi, startDeviceFlow, waitForDeviceToken } from "./auth";

const command = process.argv[2];

if (command === "polacz") {
  const code = await startDeviceFlow();
  console.log(`Otwórz link i kliknij „Zezwól”: ${code.verification_uri_complete}`);
  console.log(`Kod: ${code.user_code} (ważny ${Math.round(code.expires_in / 60)} min)`);
} else if (command === "czekaj") {
  await waitForDeviceToken();
  const me = await allegroApi<{ login: string }>("/me");
  console.log(`Połączono z kontem Allegro: ${me.login}`);
} else if (command === "test") {
  const me = await allegroApi<{ login: string; email?: string }>("/me");
  console.log(`Połączenie działa, konto: ${me.login}`);
} else {
  console.log("Użycie: npm run allegro -- polacz | czekaj | test");
  process.exit(1);
}
