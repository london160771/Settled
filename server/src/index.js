import 'dotenv/config';
import { loadConfig, ConfigError } from './config/index.js';
import { createApp } from './app.js';
import { connectDb } from './db.js';
import { startBot } from './bot/index.js';
import { startWorker } from './worker/index.js';

let config;
try {
  config = loadConfig();
} catch (err) {
  if (err instanceof ConfigError) {
    console.error(`[config] ${err.message}`);
    process.exit(1);
  }
  throw err;
}

if (!config.isTest) await connectDb(config.mongoUri);
const app = createApp(config);
if (!config.isTest) {
  const bot = await startBot(config, app);
  startWorker(config, {
    notify: bot ? (chatId, text) => bot.api.sendMessage(chatId, text) : undefined,
  });
}
app.listen(config.port, () => {
  console.log(`Settled API on :${config.port} (${config.nodeEnv}, testnet)`);
});
