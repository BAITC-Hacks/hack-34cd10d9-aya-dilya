# Firebird: контракт и интеграция

## Каркас для участника B

Общий контракт: `src/shared/contracts.ts`. Он готов независимо от реализации
подбора. `getCatalogOptions()` синхронный; `recommend(request)` асинхронный.
Публичный модуль реализации будет находиться в `src/core/index.ts`.

`matched` возвращает 1–3 карточки, `category_absent` и `no_match` — пустой массив.
`summary` нужно показывать и при успехе, и при пустой выдаче. Ошибки ввода
отклоняют Promise с `RequestValidationError` (`code: INVALID_REQUEST`, `issues`).
Технические ошибки — `RecommendationServiceError` (`code: SERVICE_ERROR`).

Все справочники содержат строки из датасета. `dateRange.min` и `dateRange.max`
задают включительные границы в формате YYYY-MM-DD. Дата — календарная строка,
не UTC timestamp. Бюджет — на одного подрядчика за мероприятие; цена «от»
не гарантирует окончательной стоимости.

Стек каркаса: React, TypeScript, Vite. Установка: `npm ci`.
Проверка типов: `npm run typecheck`. Команды `npm run dev` и `npm run build`
предназначены для будущего UI: HTML, React entry point и компоненты добавляет B.
Участник A не создаёт и не редактирует файлы интерфейса или README.

Участник B может начинать с адаптера, реализующего `RecommendationService`,
и явно обозначенных тестовых ответов. Схему контракта не менять независимо
в двух ветках. Зависимости и lock-файл ведёт A.
