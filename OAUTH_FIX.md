# Инструкция по исправлению OAuth и структуры базы данных

## Проблема

OAuth авторизация не работает, потому что структура таблицы `users` в базе данных не соответствует ожиданиям приложения.

## Правильная структура таблицы `public.users`

Приложение ожидает следующую структуру (определена в миграциях):

```sql
CREATE TABLE IF NOT EXISTS "users" (
    "id" uuid PRIMARY KEY NOT NULL,
    "first_name" text,
    "last_name" text,
    "display_name" text,
    "avatar_url" text,
    "email" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "stripe_customer_id" text,
    "github_installation_id" text,
    CONSTRAINT "users_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE cascade
);
```

## Шаги по исправлению

### 1. Проверьте текущую структуру таблицы

В Supabase Dashboard → SQL Editor выполните:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position;
```

### 2. Если таблица имеет неправильную структуру

**Вариант A: Если вы создали неправильную таблицу users с полями (email, emailVerified, fullName)**

```sql
-- Удалите неправильную таблицу (ВНИМАНИЕ: это удалит все данные!)
DROP TABLE IF EXISTS "public"."users" CASCADE;

-- Примените правильную структуру из миграций
CREATE TABLE IF NOT EXISTS "users" (
    "id" uuid PRIMARY KEY NOT NULL,
    "first_name" text,
    "last_name" text,
    "display_name" text,
    "avatar_url" text,
    "email" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "users_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE cascade
);

-- Включите RLS
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;

-- Добавьте stripe_customer_id (если нужно)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_customer_id" text;

-- Добавьте github_installation_id (если нужно)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "github_installation_id" text;
```

**Вариант B: Если таблица существует, но не хватает полей**

```sql
-- Добавьте недостающие поля
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "first_name" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_name" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "display_name" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_customer_id" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "github_installation_id" text;

-- Убедитесь, что created_at и updated_at NOT NULL
ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DEFAULT now();
ALTER TABLE "users" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "updated_at" SET NOT NULL;

-- Убедитесь, что есть foreign key на auth.users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'users_id_users_id_fk' 
        AND table_name = 'users'
    ) THEN
        ALTER TABLE "users" ADD CONSTRAINT "users_id_users_id_fk" 
        FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE cascade;
    END IF;
END $$;

-- Включите RLS
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
```

### 3. Удалите неправильные поля (если они есть)

```sql
-- Удалите поля, которые не нужны
ALTER TABLE "users" DROP COLUMN IF EXISTS "emailVerified";
ALTER TABLE "users" DROP COLUMN IF EXISTS "fullName";
-- и другие неправильные поля
```

### 4. Проверьте RLS policies

RLS policies должны быть применены из миграции `0006_rls.sql`. Проверьте:

```sql
-- Проверьте существующие policies
SELECT * FROM pg_policies WHERE tablename = 'users';

-- Если policies отсутствуют, примените их из миграции 0006_rls.sql
-- Основные policies для users:

DROP POLICY IF EXISTS "users_insert_policy" ON users;
CREATE POLICY "users_insert_policy" ON users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = users.id);

DROP POLICY IF EXISTS "users_select_policy" ON users;
CREATE POLICY "users_select_policy" ON users
FOR SELECT
TO authenticated
USING (auth.uid() = users.id);

DROP POLICY IF EXISTS "users_update_policy" ON users;
CREATE POLICY "users_update_policy" ON users
FOR UPDATE
TO authenticated
USING (auth.uid() = users.id)
WITH CHECK (auth.uid() = users.id);

DROP POLICY IF EXISTS "users_delete_policy" ON users;
CREATE POLICY "users_delete_policy" ON users
FOR DELETE
TO authenticated
USING (auth.uid() = users.id);
```

**⚠️ ВАЖНО**: OAuth callback использует admin client (service role key), который bypass RLS, поэтому policies не должны мешать созданию пользователя через callback. Policies нужны для обычных операций чтения/обновления через обычный клиент.

### 5. Примените все миграции (рекомендуется)

Если вы используете Supabase CLI, выполните:

```bash
# Перейдите в папку с миграциями
cd apps/backend

# Примените все миграции
supabase db push
```

Или примените миграции вручную через Supabase Dashboard → SQL Editor, выполняя файлы из `apps/backend/supabase/migrations/` в порядке их номеров.

### 6. Проверьте переменные окружения на Render

Убедитесь, что в Render Dashboard → Environment Variables установлены:

- `NEXT_PUBLIC_SUPABASE_URL` - URL вашего Supabase проекта
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anon key из Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Service Role Key из Supabase (важно для OAuth callback!)
- `NEXT_PUBLIC_SITE_URL` - https://promtdesign.onrender.com

### 7. Проверьте логи Render

После применения исправлений попробуйте снова войти через OAuth и проверьте логи в Render Dashboard → Logs. Ищите ошибки, связанные с:
- `Auth callback: Failed to upsert user`
- Ошибки базы данных
- Ошибки связанные с `users` таблицей

### 8. Проверьте redirect URLs в Supabase

В Supabase Dashboard → Authentication → URL Configuration:

- **Site URL**: `https://promtdesign.onrender.com`
- **Redirect URLs**: Добавьте `https://promtdesign.onrender.com/auth/callback`

## Как работает OAuth callback

1. Пользователь нажимает "Login with GitHub/Google"
2. Происходит редирект на провайдера (GitHub/Google)
3. После авторизации пользователь возвращается на `/auth/callback?code=...`
4. Callback route (`apps/web/client/src/app/auth/callback/route.ts`):
   - Обменивает код на сессию через `supabase.auth.exchangeCodeForSession(code)`
   - Извлекает данные пользователя из `auth.users` (создается автоматически Supabase)
   - Создает/обновляет запись в `public.users` через admin client (bypass RLS)
   - Редиректит на `/auth/redirect`

## Диагностика

Если проблема сохраняется:

1. **Проверьте логи Render** после попытки входа
2. **Проверьте логи Supabase** в Dashboard → Logs → Postgres Logs
3. **Проверьте структуру таблицы** через SQL Editor
4. **Убедитесь, что Service Role Key правильно установлен** (необходим для bypass RLS)

## Контакты

Если проблема не решается, проверьте:
- Все ли миграции применены
- Правильно ли настроены переменные окружения
- Работает ли Supabase Auth (проверьте, создаются ли записи в `auth.users`)
