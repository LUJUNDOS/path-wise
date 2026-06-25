-- PATH-WISE · 初始迁移：全部 9 张表
-- 依据：docs/数据库设计规格书_v1.0.0.md §3
-- 生成日期：2026-06-23

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "phone" VARCHAR(20),
    "email" VARCHAR(255),
    "nickname" VARCHAR(64) NOT NULL DEFAULT '旅行者',
    "avatar_url" TEXT,
    "default_budget_level" VARCHAR(20) DEFAULT 'comfort',
    "default_pace_level" VARCHAR(20) DEFAULT 'moderate',
    "default_accommodation" VARCHAR(30) DEFAULT 'any',
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'generating',
    "request_snapshot" JSONB NOT NULL,
    "departure_city" VARCHAR(50) NOT NULL,
    "total_days" SMALLINT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "total_estimated_cost_cny" DECIMAL(10,2),
    "budget_breakdown" JSONB,
    "llm_provider" VARCHAR(30),
    "generation_time_ms" INTEGER,
    "incomplete_reason" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "day_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trip_id" UUID NOT NULL,
    "day_index" SMALLINT NOT NULL,
    "date" DATE NOT NULL,
    "day_type" VARCHAR(30) NOT NULL,
    "city_name" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "transport_info" JSONB,
    "energy_summary" JSONB,
    "tips" TEXT[],
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "day_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeline_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "day_plan_id" UUID NOT NULL,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "item_type" VARCHAR(30) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "location" JSONB,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "estimated_duration_min" SMALLINT NOT NULL,
    "estimated_cost_cny" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "energy_level" VARCHAR(10) NOT NULL DEFAULT 'MEDIUM',
    "booking_required" BOOLEAN NOT NULL DEFAULT false,
    "booking_url" TEXT,
    "deep_links" JSONB,
    "alternatives" JSONB DEFAULT '[]',
    "amap_poi_id" VARCHAR(50),
    "is_user_modified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "timeline_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_recommendations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trip_id" UUID NOT NULL,
    "day_plan_id" UUID NOT NULL,
    "city_name" VARCHAR(50) NOT NULL,
    "check_in_date" DATE NOT NULL,
    "check_out_date" DATE NOT NULL,
    "nights" SMALLINT NOT NULL,
    "primary_option" JSONB NOT NULL,
    "backup_option" JSONB NOT NULL,
    "recommendation_reason" TEXT,
    "user_choice" VARCHAR(20) DEFAULT 'primary',
    "custom_hotel" JSONB,
    "estimated_total_cny" DECIMAL(10,2),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "hotel_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name_zh" VARCHAR(50) NOT NULL,
    "name_en" VARCHAR(100) NOT NULL,
    "province" VARCHAR(50) NOT NULL,
    "amap_city_code" VARCHAR(10) NOT NULL,
    "amap_adcode" VARCHAR(10) NOT NULL,
    "kb_status" VARCHAR(20) NOT NULL DEFAULT 'unavailable',
    "kb_version" VARCHAR(20),
    "kb_last_updated" DATE,
    "is_hub_city" BOOLEAN NOT NULL DEFAULT false,
    "typical_days" SMALLINT DEFAULT 3,
    "center_lat" DECIMAL(10,7),
    "center_lng" DECIMAL(10,7),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trip_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "llm_provider" VARCHAR(30),
    "llm_model" VARCHAR(50),
    "fallback_chain" TEXT[],
    "input_tokens" INTEGER DEFAULT 0,
    "output_tokens" INTEGER DEFAULT 0,
    "estimated_cost_cny" DECIMAL(8,4),
    "amap_api_calls" INTEGER DEFAULT 0,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "total_time_ms" INTEGER,
    "steps" JSONB DEFAULT '[]',
    "error_code" VARCHAR(50),
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generation_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_share_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trip_id" UUID NOT NULL,
    "share_token" VARCHAR(16) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMPTZ,
    "password" VARCHAR(64),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "trip_share_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_call_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "generation_task_id" UUID,
    "user_id" UUID,
    "provider" VARCHAR(30) NOT NULL,
    "model" VARCHAR(50) NOT NULL,
    "task_type" VARCHAR(50) NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_cny" DECIMAL(8,6) NOT NULL DEFAULT 0,
    "response_time_ms" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "error_message" TEXT,
    "fallback_from" VARCHAR(30),
    "called_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "trips_user_id_idx" ON "trips"("user_id");

-- CreateIndex
CREATE INDEX "trips_status_idx" ON "trips"("status");

-- CreateIndex
CREATE INDEX "trips_start_date_idx" ON "trips"("start_date");

-- CreateIndex
CREATE INDEX "day_plans_trip_id_idx" ON "day_plans"("trip_id");

-- CreateIndex
CREATE UNIQUE INDEX "day_plans_trip_id_day_index_key" ON "day_plans"("trip_id", "day_index");

-- CreateIndex
CREATE INDEX "timeline_items_day_plan_id_idx" ON "timeline_items"("day_plan_id");

-- CreateIndex
CREATE INDEX "timeline_items_item_type_idx" ON "timeline_items"("item_type");

-- CreateIndex
CREATE INDEX "hotel_recommendations_trip_id_idx" ON "hotel_recommendations"("trip_id");

-- CreateIndex
CREATE UNIQUE INDEX "hotel_recommendations_trip_id_city_name_key" ON "hotel_recommendations"("trip_id", "city_name");

-- CreateIndex
CREATE UNIQUE INDEX "cities_name_zh_key" ON "cities"("name_zh");

-- CreateIndex
CREATE INDEX "generation_tasks_trip_id_idx" ON "generation_tasks"("trip_id");

-- CreateIndex
CREATE INDEX "generation_tasks_user_id_idx" ON "generation_tasks"("user_id");

-- CreateIndex
CREATE INDEX "generation_tasks_status_idx" ON "generation_tasks"("status");

-- CreateIndex
CREATE INDEX "generation_tasks_created_at_idx" ON "generation_tasks"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "trip_share_links_share_token_key" ON "trip_share_links"("share_token");

-- CreateIndex
CREATE INDEX "trip_share_links_share_token_idx" ON "trip_share_links"("share_token");

-- CreateIndex
CREATE INDEX "llm_call_logs_provider_called_at_idx" ON "llm_call_logs"("provider", "called_at" DESC);

-- CreateIndex
CREATE INDEX "llm_call_logs_generation_task_id_idx" ON "llm_call_logs"("generation_task_id");

-- CreateIndex
CREATE INDEX "llm_call_logs_status_called_at_idx" ON "llm_call_logs"("status", "called_at" DESC);

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "day_plans" ADD CONSTRAINT "day_plans_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_items" ADD CONSTRAINT "timeline_items_day_plan_id_fkey" FOREIGN KEY ("day_plan_id") REFERENCES "day_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_recommendations" ADD CONSTRAINT "hotel_recommendations_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_recommendations" ADD CONSTRAINT "hotel_recommendations_day_plan_id_fkey" FOREIGN KEY ("day_plan_id") REFERENCES "day_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_tasks" ADD CONSTRAINT "generation_tasks_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_tasks" ADD CONSTRAINT "generation_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_share_links" ADD CONSTRAINT "trip_share_links_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llm_call_logs" ADD CONSTRAINT "llm_call_logs_generation_task_id_fkey" FOREIGN KEY ("generation_task_id") REFERENCES "generation_tasks"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
