# AI Architect Hub v4 — full-stack

Полноценная платформа: фронтенд (как у вас) + Node.js бэкенд с авторизацией,
платежами, прокси к ИИ и кошельком «искр» (✦).

## Что добавлено к вашей v3

### Бэкенд
- **Express + SQLite** (можно заменить на Postgres)
- **Регистрация / вход / выход** (email+пароль, JWT в HTTP-only cookies)
- **OAuth**: Google, Яндекс, ВКонтакте
- **Кошелёк «искр» (✦)** — единая внутренняя валюта (1 ✦ ≈ 1 ₽)
- **Прокси к ИИ** через ваш ключ: OpenAI, Anthropic, DeepSeek, Qwen, GigaChat, YandexGPT
- **СНиП/ГОСТ-ассистент (beta)** — спец-промпт поверх Claude
- **Платежи**: ЮKassa и Robokassa (создание + вебхуки)
- **Подписки**: Free / ECO / Engineer / Company
- **Разовые пакеты**: 300 / 1 000 / 3 000 / 10 000 ✦
- **История**: чатов, транзакций, платежей

### Фронтенд (дополнения)
- **Светлая / тёмная тема** — переключатель в шапке (☾/☀), запоминается
- **Переключение курсора** — кнопка ✦/↖ в шапке для стандартного курсора
- **Личный кабинет** (`/cabinet.html`) — баланс, тарифы, искры, история
- **Страница входа/регистрации** (`/login.html`) с OAuth-кнопками
- **Индикатор баланса в шапке** — у авторизованного пользователя
- **Динамическое меню профиля** (аватар → кабинет / выход)
- **Адаптивная сетка тарифов** — теперь 4 колонки (Free/ECO/Engineer/Company)

## Запуск

```bash
# 1. Установить зависимости
npm install

# 2. Скопировать .env
cp .env.example .env
# и заполнить нужные ключи (минимум JWT_SECRET, остальное по мере подключения)

# 3. Запустить
npm start         # production
npm run dev       # с автоперезагрузкой
```

Откройте http://localhost:3000

## Как подключить платежи

### ЮKassa
1. Регистрация ИП/ООО → подключение к ЮKassa (https://yookassa.ru)
2. В личном кабинете ЮKassa получите `shopId` и `secretKey`
3. Заполните `.env`:
   ```
   YOOKASSA_SHOP_ID=...
   YOOKASSA_SECRET_KEY=...
   ```
4. В ЮKassa добавьте webhook на URL `https://ваш-сайт.ru/api/webhooks/yookassa`
   с событием `payment.succeeded`.

### Robokassa
1. Регистрация: https://robokassa.ru
2. Получите `MerchantLogin`, `Password1`, `Password2`
3. Заполните в `.env`
4. В кабинете Robokassa укажите Result URL:
   `https://ваш-сайт.ru/api/webhooks/robokassa`
5. Уберите `ROBOKASSA_TEST_MODE=1` после тестов.

## Как подключить OAuth

| Провайдер | Где регистрировать | Callback URL |
|---|---|---|
| Google | https://console.cloud.google.com | `/api/oauth/google/callback` |
| Яндекс | https://oauth.yandex.ru | `/api/oauth/yandex/callback` |
| VK | https://dev.vk.com | `/api/oauth/vk/callback` |

Сохраните `CLIENT_ID` и `CLIENT_SECRET` в `.env`. Кнопки появятся
на `/login.html` автоматически.

## Как подключить ИИ-провайдеры

### Сейчас включены роутом `/api/ai/chat`
| Модель | Где получить ключ | Переменная в .env |
|---|---|---|
| GPT-4o, GPT-4o mini, o1 | platform.openai.com | `OPENAI_API_KEY` |
| Claude 3.5 Sonnet/Haiku | console.anthropic.com | `ANTHROPIC_API_KEY` |
| DeepSeek V3, R1 | platform.deepseek.com | `DEEPSEEK_API_KEY` |
| Qwen Max | dashscope.aliyun.com | `QWEN_API_KEY` |
| GigaChat Pro | developers.sber.ru/gigachat | `GIGACHAT_AUTH_KEY` |
| YandexGPT Pro | console.cloud.yandex.ru | `YANDEX_GPT_API_KEY` + `YANDEX_FOLDER_ID` |

Любые ключи можно не задавать — модели просто пропадут из выбора.

## Экономика искр

См. `server/services/pricing.js`. Логика:

```
себестоимость = (tokens_in × in_price + tokens_out × out_price) / 1M
цена_рубли = себестоимость × USD_RUB (или сразу в рублях для российских)
цена_искр = ceil(цена_рубли × MARGIN)
```

По умолчанию `MARGIN = 1.7` (наценка 70%). Меняйте под себя.

## Структура

```
aihub/
├── package.json
├── .env.example
├── server/
│   ├── index.js          ← старт Express
│   ├── db/
│   │   └── index.js      ← SQLite + миграции
│   ├── middleware/
│   │   └── auth.js       ← JWT
│   ├── routes/
│   │   ├── auth.js       ← регистрация/вход
│   │   ├── oauth.js      ← Google/Яндекс/VK
│   │   ├── user.js       ← /me, транзакции
│   │   ├── ai.js         ← прокси к ИИ + списание ✦
│   │   ├── billing.js    ← создание платежей
│   │   └── webhooks.js   ← вебхуки от ЮKassa/Robokassa
│   └── services/
│       ├── pricing.js    ← тарифы, пакеты, цены моделей
│       └── ai-providers.js ← единый интерфейс ко всем ИИ
└── public/
    ├── index.html        ← главная (как у вас, обновлена)
    ├── login.html        ← вход/регистрация
    ├── cabinet.html      ← личный кабинет
    ├── css/
    │   ├── style.css     ← ваш стиль
    │   └── theme.css     ← светлая тема + переключатели + кабинет
    ├── js/
    │   ├── main.js       ← анимации (как у вас)
    │   ├── app.js        ← НОВЫЙ: тема/курсор/профиль/баланс
    │   └── ai-api.js     ← переписан под сервер
    └── pages/            ← страницы каталога (как у вас)
        ├── visualization.html
        ├── text-ai.html
        ├── bim-ai.html
        ├── analysis.html
        ├── planning.html
        └── construction.html
```

## Безопасность

- Пароли — bcrypt
- JWT в HttpOnly + SameSite=Lax cookies (15 мин access + 30 дн refresh)
- Rate-limit на /api/auth (20 запросов / 15 мин) и /api/ai (60 / мин)
- API-ключи ИИ только на сервере, в браузер не уходят
- Robokassa-вебхук проверяется MD5-подписью с Password2
- ЮKassa — через `internal_payment_id` в metadata (защита от подмены)

## Что ещё стоит сделать

- [ ] Подключить почту (Nodemailer) для писем-подтверждений и чеков
- [ ] Загрузка изображений для Midjourney / SDXL (отдельный эндпоинт)
- [ ] Стриминг ответов (SSE) — сейчас сразу весь ответ
- [ ] Реальная база знаний СНиП/ГОСТ (RAG через pgvector / Qdrant)
- [ ] Юридические страницы: оферта, политика, согласие на 152-ФЗ
- [ ] Перенести SQLite → Postgres перед прод-нагрузкой

## Хоткеи

| Действие | Хоткей |
|---|---|
| Быстрый поиск | `Ctrl/Cmd + K` |
| Переключить тему | клик ☾/☀ в шапке |
| Переключить курсор | клик ✦/↖ в шапке |
