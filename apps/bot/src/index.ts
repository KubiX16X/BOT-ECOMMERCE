import { loadEnv } from "@revion/core";
import { createBot } from "./bot";

loadEnv();
const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
if (!token) {
  console.error("Brak TELEGRAM_BOT_TOKEN w pliku .env. Utwórz bota u @BotFather i wklej token.");
  process.exit(1);
}

const bot = createBot(token);
await bot.api.setMyCommands([
  { command: "nowa", description: "Nowa oferta" },
  { command: "limity", description: "Limity darmowych ogłoszeń OLX" },
  { command: "anuluj", description: "Przerwij bieżącą ofertę" },
  { command: "pomoc", description: "Jak to działa" },
]);

const stop = () => void bot.stop();
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

console.log("Bot Revion działa. Napisz do niego /nowa w Telegramie.");
await bot.start({ drop_pending_updates: true });
