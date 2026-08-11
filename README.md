# Legal Bridge Service

Односторінковий сайт юридичного сервісу, підготовлений до розміщення на Vercel.

## Структура проєкту

```text
.
├── index.html                    # Семантична розмітка сторінки
├── api/                          # Серверні функції Vercel
├── src/
│   ├── assets/
│   │   ├── images/               # Оптимізовані зображення
│   │   └── video/                # Відеоматеріали
│   ├── scripts/
│   │   ├── main.js               # Точка входу JavaScript
│   │   └── modules/              # Незалежні модулі FAQ і форми
│   └── styles/
│       ├── main.css              # Точка входу стилів
│       ├── base.css              # Змінні, reset і типографіка
│       ├── layout.css            # Навігація та футер
│       ├── sections.css          # Стилі секцій лендінгу
│       └── responsive.css        # Адаптивність і reduced motion
├── public/                       # Favicon, robots.txt та social preview
├── references/                   # Оригінальний шаблон і бренд-матеріали
├── package.json
└── vercel.json
```

## Локальний запуск

```bash
npm install
npm run dev
```

## Перевірка production-збірки

```bash
npm run build
```

Готові файли з'являться в папці `dist`.

## Розміщення на Vercel

Імпортуйте папку проєкту або Git-репозиторій у Vercel. Налаштування вже збережені у `vercel.json`:

- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`

У налаштуваннях Vercel додайте змінні середовища з `.env.example`:

- `LEELOO_API_TOKEN` — секретний API-токен Leeloo.ai.
- `LEELOO_LEADGENTOOL_ID` — ID інструменту лідогенерації, куди потраплятимуть заявки.

Локальні секрети зберігаються в `.env.local`, який виключений із Git.

## Форма заявки та Leeloo.ai

Форма надсилає ім’я, телефон і короткий опис проблеми на серверний endpoint `/api/leeloo-lead`. Сервер створює картку клієнта в Leeloo.ai та додає опис проблеми коментарем до картки. API-токен ніколи не передається в браузер.

Для локальної перевірки лише статичної частини використовуйте `npm run dev`. Повна перевірка Vercel Functions виконується через Vercel Preview/Production deployment.
