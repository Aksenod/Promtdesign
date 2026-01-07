-- Скрипт для исправления структуры таблицы users
-- Выполните этот скрипт в Supabase Dashboard → SQL Editor

-- Сначала проверьте текущую структуру
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'users'
-- ORDER BY ordinal_position;

-- Вариант 1: Добавление недостающих полей (если таблица уже существует)
-- Этот вариант безопасен и не удалит данные

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

-- Убедитесь, что created_at и updated_at имеют правильные значения по умолчанию
DO $$
BEGIN
    -- Установите DEFAULT если его нет
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'created_at' 
        AND column_default IS NOT NULL
    ) THEN
        ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT now();
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'updated_at' 
        AND column_default IS NOT NULL
    ) THEN
        ALTER TABLE "users" ALTER COLUMN "updated_at" SET DEFAULT now();
    END IF;
END $$;

-- Установите значения по умолчанию для существующих записей (если нужно)
UPDATE "users" SET "created_at" = now() WHERE "created_at" IS NULL;
UPDATE "users" SET "updated_at" = now() WHERE "updated_at" IS NULL;

-- Сделайте created_at и updated_at NOT NULL
ALTER TABLE "users" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "updated_at" SET NOT NULL;

-- Убедитесь, что есть foreign key на auth.users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'users_id_users_id_fk' 
        AND table_name = 'users'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE "users" ADD CONSTRAINT "users_id_users_id_fk" 
        FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE cascade;
    END IF;
END $$;

-- Включите RLS (Row Level Security)
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;

-- Удалите неправильные поля (если они были созданы вручную)
-- ВНИМАНИЕ: Раскомментируйте только если уверены, что эти поля не нужны
-- ALTER TABLE "users" DROP COLUMN IF EXISTS "emailVerified";
-- ALTER TABLE "users" DROP COLUMN IF EXISTS "fullName";

-- Проверьте результат
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position;
