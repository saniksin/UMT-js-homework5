# UMT-js-homework12 — Announcements REST API: безпека, логування, фото

Фінальний етап «Дошки оголошень». Це розширення
[homework11](https://github.com/saniksin/UMT-js-homework4) (REST API з
JWT-автентифікацією, bcrypt, token rotation та ownership) — додано **базову
безпеку** (helmet, CORS, rate limiting), **структуроване логування** через
pino та **завантаження фото оголошень** у Cloudinary.

## Що нового порівняно з homework11

| Можливість | Деталі |
|------------|--------|
| **Helmet** | Безпечні HTTP-заголовки до всіх маршрутів; `X-Powered-By` прибрано. CSP вимкнено, щоб не ламати Swagger UI. |
| **CORS** | `cors` з білим списком origin зі змінної `ALLOWED_ORIGINS`; недозволений origin → `403 Not allowed by CORS`. |
| **Rate limiting** | `express-rate-limit` лише на `/auth` — 10 запитів з IP за 15 хв, далі `429 Too many requests, please try again later`. |
| **Логування** | `pino` ініціалізований у `src/logger.js`; `pino-http` логує кожен запит; у контролерах логуються реєстрація, вхід, створення оголошення та завантаження фото. |
| **Фото** | `multer` зберігає файл у `uploads/`, `cloudinary` заливає його в хмару, локальний файл видаляється; у БД зберігається лише `imageUrl`. |
| **Схема БД** | `Announcement.imageUrl String?` (опціональне) + міграція. |

## Стек

| Технологія | Призначення |
|------------|-------------|
| **Node.js + Express 5** | HTTP-сервер |
| **Prisma 7 + SQLite** | ORM + БД (`better-sqlite3` адаптер) |
| **helmet** | безпечні HTTP-заголовки |
| **cors** | контроль cross-origin доступу |
| **express-rate-limit** | обмеження кількості запитів на `/auth` |
| **pino + pino-http + pino-pretty** | структуроване логування |
| **multer + cloudinary** | завантаження фото у хмару |
| **bcrypt / jsonwebtoken / cookie-parser** | автентифікація (з homework11) |
| **celebrate (Joi)** | валідація body / params / query |
| **http-errors** | `401`/`403`/`409` через `createHttpError` |
| **swagger-jsdoc + swagger-ui-express** | автодокументація на `/api-docs` |

## Структура проєкту

```
homework12/
├── prisma/
│   ├── schema.prisma            # User, RefreshToken, Announcement(imageUrl?)
│   ├── client.js                # PrismaClient + better-sqlite3 адаптер
│   ├── seed.js                  # 2 демо-юзери + 25 оголошень
│   └── migrations/
│       ├── 20260522130547_init/
│       └── ..._add_image_url_to_announcement/
├── src/
│   ├── constants/time.js
│   ├── controllers/
│   │   ├── announcements.controller.js # CRUD + ownership + фото + логування
│   │   └── auth.controller.js          # register/login/refresh/logout/me + логування
│   ├── middleware/
│   │   ├── auth.middleware.js   # Bearer JWT → req.user.id
│   │   └── upload.middleware.js # multer({ dest: 'uploads/' })
│   ├── routes/
│   │   ├── announcements.routes.js
│   │   └── auth.routes.js
│   ├── services/
│   │   ├── auth.js              # createTokens, set/clearRefreshTokenCookie
│   │   └── cloudinary.js        # config + uploadImage(filePath) → secure_url
│   ├── validators/
│   └── logger.js                # єдиний екземпляр pino
├── uploads/                     # тимчасове сховище (вміст у .gitignore)
├── app.js                       # cors → helmet → pino-http → роутери → error handler
├── requests.http
├── .env / .env.example
└── package.json
```

## Швидкий старт

```bash
npm install                  # postinstall автоматично виконає prisma generate
cp .env.example .env         # заповніть CLOUDINARY_* та секрети
npx prisma migrate dev       # створить dev.db та застосує міграції
npm run db:seed              # (опційно) 2 юзери + 25 оголошень
npm start                    # або npm run dev для авто-перезапуску
```

Сервер — `http://localhost:3000`, Swagger UI — `http://localhost:3000/api-docs`.

## Конфігурація `.env`

```env
DATABASE_URL="file:./dev.db"
PORT=3000

JWT_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret
NODE_ENV=development

# CORS — кома-розділений список дозволених origin
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

> Файл `.env` у `.gitignore` і в репозиторій не комітиться.

## Базова безпека (порядок middleware)

У `app.js` middleware підключені у правильному порядку:

1. **CORS** — першим, щоб preflight `OPTIONS` одразу отримав потрібні заголовки.
   Origin перевіряється функцією: запити без `Origin` (REST Client, curl) і
   запити з `ALLOWED_ORIGINS` дозволені, решта → `403 Not allowed by CORS`.
2. **Helmet** — `helmet({ contentSecurityPolicy: false })`: усі заголовки
   безпеки, крім CSP (вимкнено заради Swagger UI).
3. **pino-http** — логування кожного запиту.
4. Парсери (`express.json`, `cookie-parser`), Swagger, далі роутери.

Rate limiting підключений лише до `/auth`: `app.use('/auth', authLimiter, authRouter)`.

## Логування

`src/logger.js` створює єдиний екземпляр `pino` (у dev — `pino-pretty`, рівень
`debug`; у production — чистий JSON, рівень `info`) і експортує його. Він
імпортується в `app.js` (для `pino-http` та обробника помилок) і в контролерах.

Події, що логуються в контролерах:

| Подія | Де |
|-------|----|
| `User registered` | `auth.controller.js` (register) |
| `User logged in` | `auth.controller.js` (login) |
| `Announcement created` | `announcements.controller.js` (create) |
| `Announcement photo uploaded` | `announcements.controller.js` (create / update) |

## Фото оголошення

- `POST /announcements` і `PATCH /announcements/:id` приймають
  `multipart/form-data`; файл — у полі `image` (опціональний).
- `multer` зберігає файл у `uploads/`, далі `uploadImage()` заливає його на
  Cloudinary (папка `announcements`), повертає `secure_url` і **в блоці
  `finally` видаляє локальну копію** (навіть якщо завантаження впало).
- У БД пишеться лише `imageUrl`. Без файлу оголошення створюється з
  `imageUrl: null`.

Приклад відповіді `201 Created`:

```json
{
  "id": 2,
  "title": "Продам велосипед Trek",
  "description": "Trek у відмінному стані, майже новий",
  "price": 8500,
  "category": "sale",
  "contactInfo": "veloman@gmail.com",
  "imageUrl": "https://res.cloudinary.com/ddoti9rca/image/upload/v1/announcements/abc.png",
  "userId": 1,
  "createdAt": "2026-06-04T10:00:00.000Z",
  "updatedAt": "2026-06-04T10:00:00.000Z"
}
```

## Endpoint-и

### Публічні

| Метод | Шлях | Опис |
|-------|------|------|
| GET | `/announcements` | список (search, sort, page) |
| GET | `/announcements/:id` | одне оголошення |
| POST | `/auth/register` | реєстрація + видача токенів (rate-limited) |
| POST | `/auth/login` | вхід + видача токенів (rate-limited) |
| POST | `/auth/refresh` | rotation, нова пара (rate-limited) |
| GET | `/api-docs` | Swagger UI |

### Захищені (`Authorization: Bearer <accessToken>`)

| Метод | Шлях | Особливості |
|-------|------|-------------|
| POST | `/auth/logout` | видаляє refresh з БД, очищує cookie |
| GET | `/auth/me` | профіль поточного юзера (без `password`) |
| POST | `/announcements` | `multipart/form-data` + фото; `userId` з токена |
| PATCH | `/announcements/:id` | `multipart/form-data` + фото; ownership 403 |
| DELETE | `/announcements/:id` | ownership 403 |

## Скрипти `npm`

```bash
npm start                # node app.js
npm run dev              # node --watch app.js
npm run prisma:migrate   # prisma migrate dev
npm run prisma:generate  # prisma generate
npm run db:seed          # 2 юзери + 25 оголошень
```

## Відповідність критеріїв `task.txt` (20 балів)

| # | Критерій | Бали | Реалізація |
|---|----------|------|-----------|
| 1 | Helmet (підключений + заголовки у відповіді) | 2 | `app.js` `helmet({ contentSecurityPolicy: false })` |
| 2 | CORS (білий список + помилка на чужий origin) | 2 | `app.js` `cors({ origin: fn, credentials: true })` → 403 |
| 3 | Rate limiting (тільки auth, 10/15хв, 429) | 3 | `authLimiter` на `app.use('/auth', ...)` |
| 4 | Логування pino (logger.js, pino-http, події) | 4 | `src/logger.js`, `pino-http` у `app.js`, логи в контролерах |
| 5 | Схема БД: `imageUrl` опціональний + міграція | 1 | `schema.prisma`, `..._add_image_url_to_announcement` |
| 6 | Завантаження фото (multer→Cloudinary→unlink, опц.) | 4 | `upload.middleware.js`, `services/cloudinary.js`, контролер |
| 7 | Swagger (multipart у документації, `/api-docs`) | 2 | JSDoc `multipart/form-data` у `announcements.routes.js` |
| 8 | `requests.http` (rate limit >10, запит з фото) | 2 | секції 12 (11 запитів) та 13 (multipart з фото) |
| **Σ** | | **20** | усі критерії перевірено E2E |
