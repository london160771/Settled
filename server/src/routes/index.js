// REST API. Routes call services; no business logic here.
import express from 'express';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { AppError } from '../errors.js';
import { User, Decision, Receipt, Claim } from '../models/index.js';
import * as auth from '../services/auth.js';
import * as cases from '../services/cases.js';
import * as claims from '../services/claims/index.js';
import * as account from '../services/account.js';
import { checkCase } from '../services/flights/evidence.js';
import { getBudget } from '../services/budget/index.js';
import * as ask from '../services/ask/index.js';
import * as judge from '../services/judge.js';
import { runAttacks } from '../services/attacks/index.js';
import { VENDORS, DEFAULT_TIERS } from '../services/sla/vendors.js';

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function apiRouter(config, deps = {}) {
  const r = express.Router();
  r.use(cookieParser());
  const limiter = (max) =>
    rateLimit({
      windowMs: 60 * 1000,
      limit: config.isTest ? 10000 : max,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_q, _s, next) => next(new AppError('RATE_LIMITED', 'Too many requests')),
    });
  const cookieOpts = {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: 30 * 24 * 3600 * 1000,
  };
  const login = (res, user) =>
    res.cookie(auth.COOKIE, auth.signToken(config, user._id), cookieOpts);

  const requireUser = wrap(async (req, _res, next) => {
    const uid = auth.verifyToken(config, req.cookies?.[auth.COOKIE]);
    const user = uid && (await User.findById(uid));
    if (!user) throw new AppError('UNAUTHORIZED', 'Sign in first.');
    req.user = user;
    next();
  });

  // Auth
  r.post(
    '/auth/signup',
    limiter(20),
    wrap(async (req, res) => {
      const user = await auth.signUp(config, req.body || {});
      login(res, user)
        .status(201)
        .json({ user: auth.publicUser(user) });
    }),
  );
  r.post(
    '/auth/signin',
    limiter(20),
    wrap(async (req, res) => {
      const user = await auth.signIn(req.body || {});
      login(res, user).json({ user: auth.publicUser(user) });
    }),
  );
  r.post('/auth/signout', (_req, res) => res.clearCookie(auth.COOKIE).json({ ok: true }));
  r.get(
    '/auth/link/:code',
    limiter(20),
    wrap(async (req, res) => {
      const uid = await auth.consumeLinkCode(req.params.code, 'weblogin');
      login(res, { _id: uid }).redirect(config.webUrl);
    }),
  );
  r.get('/me', requireUser, (req, res) => res.json({ user: auth.publicUser(req.user) }));

  // Cases + claims
  r.get('/sla/vendors', (_req, res) =>
    res.json({
      vendors: Object.entries(VENDORS).map(([key, v]) => ({ key, name: v.name })),
      defaultTiers: DEFAULT_TIERS,
    }),
  );
  r.get(
    '/cases',
    requireUser,
    wrap(async (req, res) => {
      const list = await cases.listCases(req.user._id);
      const decisions = await Decision.find({ caseId: { $in: list.map((c) => c._id) } })
        .sort({ createdAt: -1 })
        .lean();
      const latest = new Map();
      for (const d of decisions) if (!latest.has(String(d.caseId))) latest.set(String(d.caseId), d);
      res.json({ cases: list.map((c) => ({ ...c, decision: latest.get(String(c._id)) || null })) });
    }),
  );
  r.post(
    '/cases',
    requireUser,
    wrap(async (req, res) => {
      res.status(201).json({ case: await cases.addCase(req.user._id, req.body || {}) });
    }),
  );
  r.get(
    '/cases/:id',
    requireUser,
    wrap(async (req, res) => {
      const c = await cases.getCase(req.user._id, req.params.id);
      const [decision, receipts, claim] = await Promise.all([
        Decision.findOne({ caseId: c._id }).sort({ createdAt: -1 }).lean(),
        Receipt.find({ caseId: c._id }).sort({ createdAt: 1 }).lean(),
        Claim.findOne({ caseId: c._id }).lean(),
      ]);
      res.json({
        case: c,
        decision,
        receipts,
        claim,
        proofUrl: claims.proofUrl(config, c.publicId),
      });
    }),
  );
  r.post(
    '/cases/:id/check',
    requireUser,
    limiter(10),
    wrap(async (req, res) => {
      await cases.getCase(req.user._id, req.params.id);
      res.json({ decision: await checkCase(config, req.params.id, deps.telegraph || {}) });
    }),
  );
  r.post(
    '/cases/:id/draft',
    requireUser,
    wrap(async (req, res) => {
      res
        .status(201)
        .json({ claim: await claims.createDraft(config, req.user._id, req.params.id) });
    }),
  );
  r.patch(
    '/claims/:id',
    requireUser,
    wrap(async (req, res) => {
      res.json({ claim: await claims.editDraft(req.user._id, req.params.id, req.body || {}) });
    }),
  );
  r.put(
    '/claims/:id/recipient',
    requireUser,
    wrap(async (req, res) => {
      res.json({
        claim: await claims.setRecipient(config, req.user._id, req.params.id, req.body?.email),
      });
    }),
  );
  r.post(
    '/claims/:id/send',
    requireUser,
    limiter(10),
    wrap(async (req, res) => {
      const out = await claims.sendClaim(
        config,
        req.user._id,
        req.params.id,
        req.body || {},
        deps.mail || {},
      );
      res.json({ claim: out.claim, via: out.via, mailto: out.mailto || null });
    }),
  );
  r.post(
    '/claims/:id/mark-sent',
    requireUser,
    wrap(async (req, res) => {
      res.json({ claim: await claims.markSent(req.user._id, req.params.id) });
    }),
  );
  r.post(
    '/claims/:id/outcome',
    requireUser,
    wrap(async (req, res) => {
      res.json({
        claim: await claims.markOutcome(
          req.user._id,
          req.params.id,
          req.body?.outcome,
          req.body || {},
        ),
      });
    }),
  );

  // Receipts, wallet, settings
  r.get(
    '/receipts',
    requireUser,
    wrap(async (req, res) => res.json({ receipts: await account.listReceipts(req.user._id) })),
  );
  r.get(
    '/wallet',
    requireUser,
    wrap(async (req, res) =>
      res.json(await account.walletView(config, req.user._id, deps.telegraph || {})),
    ),
  );
  r.post(
    '/wallet/topup',
    requireUser,
    limiter(3),
    wrap(async (req, res) =>
      res.json(await account.requestTopUp(config, req.user._id, deps.wallet || {})),
    ),
  );
  r.get(
    '/budget',
    requireUser,
    wrap(async (req, res) => res.json(await getBudget(req.user._id))),
  );
  r.patch(
    '/settings',
    requireUser,
    wrap(async (req, res) =>
      res.json({
        user: auth.publicUser(await account.updateSettings(req.user._id, req.body || {})),
      }),
    ),
  );
  r.post(
    '/settings/telegram-code',
    requireUser,
    limiter(10),
    wrap(async (req, res) => {
      res.json({ code: await auth.createLinkCode(req.user._id, 'telegram'), expiresInMinutes: 10 });
    }),
  );

  // Mission 9
  r.post(
    '/ask',
    requireUser,
    limiter(20),
    wrap(async (req, res) => {
      res.json(
        await ask.paidAsk(
          config,
          req.user._id,
          req.body?.kind,
          req.body?.input,
          deps.telegraph || {},
        ),
      );
    }),
  );
  r.get(
    '/asks',
    requireUser,
    wrap(async (req, res) => res.json({ asks: await ask.myAsks(req.user._id) })),
  );
  r.get(
    '/leaderboard',
    wrap(async (_req, res) => res.json({ rows: await ask.leaderboard() })),
  );

  // Judge mode + Attack Lab
  const optionalUser = wrap(async (req, _res, next) => {
    const uid = auth.verifyToken(config, req.cookies?.[auth.COOKIE]);
    req.user = uid ? await User.findById(uid) : null;
    next();
  });
  r.post(
    '/judge/session',
    limiter(5),
    optionalUser,
    wrap(async (req, res) => {
      const out = await judge.judgeSession(config, req.user, deps);
      login(res, out.user).json({
        user: auth.publicUser(out.user),
        reused: out.reused,
        funding: out.funding || null,
      });
    }),
  );
  const requireDemo = (req, _res, next) =>
    req.user?.isDemo ? next() : next(new AppError('BAD_REQUEST', 'Start a judge session first.'));
  r.post(
    '/judge/demo',
    requireUser,
    requireDemo,
    limiter(5),
    wrap(async (req, res) => res.json(await judge.runDemo(config, req.user, deps))),
  );
  r.post(
    '/judge/attacks',
    requireUser,
    requireDemo,
    limiter(5),
    wrap(async (req, res) => res.json(await runAttacks(config, req.user, deps))),
  );

  // Public proof page
  r.get(
    '/proof/:publicId',
    wrap(async (req, res) => res.json(await claims.getProof(req.params.publicId))),
  );

  r.use((err, _req, res, _next) => {
    if (err instanceof AppError) return res.status(err.status).json({ error: err.toJSON() });
    if (err?.type === 'entity.parse.failed')
      return res.status(400).json({ error: new AppError('BAD_REQUEST', 'Bad JSON').toJSON() });
    if (err?.name === 'CastError')
      return res.status(404).json({ error: new AppError('NOT_FOUND', 'Not found').toJSON() });
    console.error('[api]', err?.message);
    return res.status(500).json({
      error: {
        code: 'INTERNAL',
        message: 'Something went wrong.',
        retryable: true,
        nextAction: 'Try again.',
      },
    });
  });
  return r;
}
