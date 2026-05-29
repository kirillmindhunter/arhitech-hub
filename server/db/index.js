/* ============================================================
   База данных — SQLite (better-sqlite3)
   Для прод-нагрузок просто замените на pg/Knex — интерфейс
   одинаковый: db.prepare(...).run() / .get() / .all()
   ============================================================ */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './data/aihub.db';
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function init() {
  // ===== Пользователи =====
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password_hash TEXT,
      name TEXT,
      avatar_url TEXT,
      oauth_provider TEXT,
      oauth_id TEXT,
      sparks_balance INTEGER DEFAULT 50,
      subscription_plan TEXT DEFAULT 'free',
      subscription_until DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id);

    -- ===== Транзакции искр (баланс кошелька) =====
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,        -- 'topup' | 'spend' | 'subscription' | 'bonus' | 'refund'
      amount INTEGER NOT NULL,   -- положительное = пополнение, отрицательное = списание
      balance_after INTEGER NOT NULL,
      meta TEXT,                 -- JSON: { model, provider, tokens_in, tokens_out, payment_id, ... }
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id, created_at DESC);

    -- ===== Платежи (заказы) =====
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      provider TEXT NOT NULL,     -- 'yookassa' | 'robokassa'
      external_id TEXT,           -- ID платежа в системе
      amount_rub REAL NOT NULL,
      sparks_to_add INTEGER NOT NULL,
      plan TEXT,                  -- если подписка
      status TEXT DEFAULT 'pending', -- pending | succeeded | failed | refunded
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_pay_user ON payments(user_id);
    CREATE INDEX IF NOT EXISTS idx_pay_ext ON payments(external_id);

    -- ===== История чатов =====
    CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT,
      model TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      role TEXT NOT NULL,         -- 'user' | 'assistant' | 'system'
      content TEXT NOT NULL,
      sparks_cost INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    );

    -- ===== Refresh-токены =====
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  console.log('[DB] инициализирована:', DB_PATH);
  return Promise.resolve();
}

module.exports = { db, init };
