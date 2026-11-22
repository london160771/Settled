// grammY wiring: maps Telegram updates to handlers. Long polling in dev, webhook in production.
import { Bot, InlineKeyboard, webhookCallback } from 'grammy';
import { createHandlers } from './handlers.js';

function ioFrom(ctx) {
  return {
    telegramId: ctx.from.id,
    name: [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' '),
    reply: (text, opts = {}) => {
      const extra = {};
      if (opts.buttons) {
        const kb = new InlineKeyboard();
        opts.buttons.forEach((row, i) => {
          row.forEach((b) => kb.text(b.text.slice(0, 60), b.data));
          if (i < opts.buttons.length - 1) kb.row();
        });
        extra.reply_markup = kb;
      }
      return ctx.reply(text, extra);
    },
  };
}

export function createBot(config, deps = {}) {
  const bot = new Bot(config.telegramBotToken, deps.botConfig);
  const h = createHandlers(config, deps);
  bot.command('start', (ctx) => h.start(ioFrom(ctx), ctx.match?.trim() || null));
  bot.command('claims', (ctx) => h.listClaims(ioFrom(ctx)));
  bot.command('wallet', (ctx) => h.wallet(ioFrom(ctx)));
  bot.command('cap', (ctx) => h.cap(ioFrom(ctx), ctx.match?.trim()));
  bot.command('web', (ctx) => h.web(ioFrom(ctx)));
  if (deps.extraCommands) deps.extraCommands(bot, h, ioFrom);
  bot.on('callback_query:data', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    return h.callback(ioFrom(ctx), ctx.callbackQuery.data);
  });
  bot.on('message:text', (ctx) =>
    h.text(ioFrom(ctx), ctx.message.text, { forwarded: !!ctx.message.forward_origin }),
  );
  bot.catch((err) => console.error('[bot]', err.message));
  return { bot, handlers: h };
}

export async function startBot(config, app, deps = {}) {
  if (!config.telegramBotToken) {
    console.log('[bot] TELEGRAM_BOT_TOKEN not set; bot is off.');
    return null;
  }
  const { bot } = createBot(config, deps);
  await bot.api.setMyCommands([
    { command: 'claims', description: 'Your claims' },
    { command: 'wallet', description: 'Wallet, balance and cap' },
    { command: 'cap', description: 'Set monthly cap, e.g. /cap 1.50' },
    { command: 'web', description: 'One-time login link for the web app' },
  ]);
  if (config.isProd && config.telegramWebhookSecret) {
    app.use(
      '/api/telegram/webhook',
      webhookCallback(bot, 'express', { secretToken: config.telegramWebhookSecret }),
    );
    await bot.api.setWebhook(`${config.appUrl}/api/telegram/webhook`, {
      secret_token: config.telegramWebhookSecret,
    });
    console.log('[bot] webhook mode');
  } else {
    bot.start({ drop_pending_updates: true });
    console.log('[bot] long polling');
  }
  return bot;
}
