import express from 'express';

export function createApp(config) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '200kb' }));
  app.locals.config = config;

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, network: 'Ethereum Sepolia (testnet)', chainId: config.chainId });
  });

  return app;
}
