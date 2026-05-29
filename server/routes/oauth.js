/* OAuth: Google / Яндекс / VK
   Делается по passport. Здесь — каркас, после получения ключей
   просто заполните .env, и роуты заработают.
*/
const router = require('express').Router();
const passport = require('passport');
const { db } = require('../db');
const { signAccessToken, signRefreshToken } = require('../middleware/auth');

const cookieOpts = {
  httpOnly: true, sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production'
};

function upsertOAuthUser({ provider, oauthId, email, name, avatar_url }) {
  let user = db.prepare(
    'SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?'
  ).get(provider, oauthId);

  if (!user && email) {
    user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (user) {
      db.prepare('UPDATE users SET oauth_provider = ?, oauth_id = ?, avatar_url = COALESCE(avatar_url, ?) WHERE id = ?')
        .run(provider, oauthId, avatar_url, user.id);
    }
  }

  if (!user) {
    const result = db.prepare(`
      INSERT INTO users (email, name, avatar_url, oauth_provider, oauth_id, sparks_balance)
      VALUES (?, ?, ?, ?, ?, 50)
    `).run(email || null, name || provider + '_user', avatar_url || null, provider, oauthId);
    const userId = result.lastInsertRowid;
    db.prepare(`INSERT INTO transactions (user_id, type, amount, balance_after, meta)
                VALUES (?, 'bonus', 50, 50, ?)`).run(userId, JSON.stringify({ reason: 'Регистрация через ' + provider }));
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  }

  return user;
}

function finalizeOAuth(req, res, user) {
  const access = signAccessToken(user.id);
  const refresh = signRefreshToken(user.id);
  res.cookie('access_token', access, { ...cookieOpts, maxAge: 15 * 60_000 });
  res.cookie('refresh_token', refresh, { ...cookieOpts, maxAge: 30 * 86400_000 });
  res.redirect('/cabinet.html');
}

// ===== Google =====
if (process.env.GOOGLE_CLIENT_ID) {
  const GoogleStrategy = require('passport-google-oauth20').Strategy;
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/api/oauth/google/callback'
  }, (accessToken, refreshToken, profile, done) => {
    const user = upsertOAuthUser({
      provider: 'google',
      oauthId: profile.id,
      email: profile.emails?.[0]?.value,
      name: profile.displayName,
      avatar_url: profile.photos?.[0]?.value
    });
    done(null, user);
  }));
  router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
  router.get('/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/login.html?error=oauth' }),
    (req, res) => finalizeOAuth(req, res, req.user)
  );
}

// ===== Яндекс =====
if (process.env.YANDEX_CLIENT_ID) {
  const YandexStrategy = require('passport-yandex').Strategy;
  passport.use(new YandexStrategy({
    clientID: process.env.YANDEX_CLIENT_ID,
    clientSecret: process.env.YANDEX_CLIENT_SECRET,
    callbackURL: '/api/oauth/yandex/callback'
  }, (accessToken, refreshToken, profile, done) => {
    const user = upsertOAuthUser({
      provider: 'yandex',
      oauthId: profile.id,
      email: profile.emails?.[0]?.value,
      name: profile.displayName,
      avatar_url: profile._json?.default_avatar_id ? `https://avatars.yandex.net/get-yapic/${profile._json.default_avatar_id}/islands-200` : null
    });
    done(null, user);
  }));
  router.get('/yandex', passport.authenticate('yandex', { session: false }));
  router.get('/yandex/callback',
    passport.authenticate('yandex', { session: false, failureRedirect: '/login.html?error=oauth' }),
    (req, res) => finalizeOAuth(req, res, req.user)
  );
}

// ===== VK =====
if (process.env.VK_CLIENT_ID) {
  const VKStrategy = require('passport-vkontakte').Strategy;
  passport.use(new VKStrategy({
    clientID: process.env.VK_CLIENT_ID,
    clientSecret: process.env.VK_CLIENT_SECRET,
    callbackURL: '/api/oauth/vk/callback',
    scope: ['email']
  }, (accessToken, refreshToken, params, profile, done) => {
    const user = upsertOAuthUser({
      provider: 'vk',
      oauthId: String(profile.id),
      email: params.email,
      name: profile.displayName,
      avatar_url: profile.photos?.[0]?.value
    });
    done(null, user);
  }));
  router.get('/vk', passport.authenticate('vkontakte', { session: false }));
  router.get('/vk/callback',
    passport.authenticate('vkontakte', { session: false, failureRedirect: '/login.html?error=oauth' }),
    (req, res) => finalizeOAuth(req, res, req.user)
  );
}

router.get('/providers', (req, res) => {
  res.json({
    google: !!process.env.GOOGLE_CLIENT_ID,
    yandex: !!process.env.YANDEX_CLIENT_ID,
    vk: !!process.env.VK_CLIENT_ID
  });
});

module.exports = router;
