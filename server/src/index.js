import 'dotenv/config';
import { loadConfig, ConfigError } from './config/index.js';
import { createApp } from './app.js';
import { connectDb } from './db.js';

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
app.listen(config.port, () => {
  console.log(`Settled API on :${config.port} (${config.nodeEnv}, testnet)`);
});
