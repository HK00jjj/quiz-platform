-- ═══════════════════════════════════════════════════════════════════
-- quiz-platform P0-4 迁移：属性体系三表（2026-09-18，v7.1 配套）
--
-- ⚠ 执行方式：Supabase Dashboard → SQL Editor，人工粘贴执行（本机无 DDL 通道）。
--
-- 目的（使命排序：数据可信 > 展示好看）：
--   ① attributes          —— 属性字典（K 域 → 主题 → 属性三层；K8 首批 124 条）
--   ② question_attributes —— Q 矩阵（题↔属性；source 区分置信度分层）
--   ③ question_stats      —— 题目统计（p 值/选项分布/死选项，供 item_analysis 回写）
--
-- 设计口径：
--   · 纯新增三表，**不修改既有四表**（questions/review_cards/answer_records/settings）→ 零破坏；
--   · 单用户 RLS 模板沿用 20260911 迁移（owner-only，USING/WITH CHECK 双绑定 fail-closed）；
--   · 幂等：IF NOT EXISTS + 策略先 DROP 再 CREATE（可重复执行）；
--   · question_attributes / question_stats 均以 question_id 外键挂 questions，
--     随删题自动级联清理（避免孤儿行）。
--
-- 执行前两步（必做）：
--   1) 快照现有策略（回滚用）：
--      SELECT schemaname, tablename, policyname, cmd, qual, with_check
--      FROM pg_policies WHERE schemaname = 'public';
--   2) 取教师账号 UUID 并全文件替换 <OWNER_UUID>：
--      SELECT id, email FROM auth.users;
--
-- 验证（执行后）：
--   a) 登录态 REST：GET /rest/v1/attributes?limit=1 → 200 空数组；
--   b) 未登录（anon）读 attributes → 空数组/401；
--   c) questions 删一题（若测试）→ question_attributes 关联行级联消失。
--
-- 回滚（见文件末尾，三表均为新增，DROP 即净）；
-- 数据写入由 tools/import_attributes.mjs 在 DDL 执行后运行（INSERT/UPSERT，幂等）。
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. 属性字典表 ──
CREATE TABLE IF NOT EXISTS public.attributes (
  id         text PRIMARY KEY,                      -- 'A-CC-1'
  domain     text NOT NULL,                         -- 'K8'
  topic_id   text NOT NULL,                         -- 'T-CTRL-CIRCUIT'
  topic_name text NOT NULL,                         -- '继电器控制基本环节'
  name       text NOT NULL,                         -- '自锁接法'
  keywords   text,                                  -- 匹配关键词（审计/复现用）
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.attributes IS '属性字典（认知诊断的属性定义：K 域→主题→属性三层）';

-- ── 2. Q 矩阵（题 ↔ 属性）──
CREATE TABLE IF NOT EXISTS public.question_attributes (
  question_id  text NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  attribute_id text NOT NULL REFERENCES public.attributes(id) ON DELETE CASCADE,
  source       text NOT NULL DEFAULT 'matched'
               CHECK (source IN ('matched', 'fallback', 'manual')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, attribute_id)
);
CREATE INDEX IF NOT EXISTS idx_qa_attribute ON public.question_attributes (attribute_id);
CREATE INDEX IF NOT EXISTS idx_qa_question  ON public.question_attributes (question_id);
COMMENT ON TABLE public.question_attributes IS 'Q 矩阵：每题考查的属性（source：matched 语义命中 / fallback 主题兜底 / manual 人工）';

-- ── 3. 题目统计表 ──
CREATE TABLE IF NOT EXISTS public.question_stats (
  question_id   text PRIMARY KEY REFERENCES public.questions(id) ON DELETE CASCADE,
  attempts      integer NOT NULL DEFAULT 0,         -- 有效作答次数（清洗噪声后）
  correct_rate  numeric,                            -- 个人 p 值（难度代理）
  option_counts jsonb,                              -- 各选项被选次数 {"A":3,"B":1,...}
  dead_options  text,                               -- 从未被选的干扰项字母（'BD'）
  p_band        text,                               -- 难度分档：易/中/难（按 p 阈值）
  last_updated  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.question_stats IS '题目统计（item_analysis 回写：p 值/选项分布/死选项）';

-- ── 4. 幂等清理：删掉三表上的旧策略（本迁移首次执行时无旧策略，安全）──
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('attributes', 'question_attributes', 'question_stats')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ── 5. 启用 RLS ──
ALTER TABLE public.attributes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_stats      ENABLE ROW LEVEL SECURITY;

-- ── 6. 教师账号全权策略（唯一写入口；执行前替换 <OWNER_UUID>）──
CREATE POLICY owner_all_attributes
  ON public.attributes FOR ALL TO authenticated
  USING (auth.uid() = '<OWNER_UUID>')
  WITH CHECK (auth.uid() = '<OWNER_UUID>');

CREATE POLICY owner_all_question_attributes
  ON public.question_attributes FOR ALL TO authenticated
  USING (auth.uid() = '<OWNER_UUID>')
  WITH CHECK (auth.uid() = '<OWNER_UUID>');

CREATE POLICY owner_all_question_stats
  ON public.question_stats FOR ALL TO authenticated
  USING (auth.uid() = '<OWNER_UUID>')
  WITH CHECK (auth.uid() = '<OWNER_UUID>');

-- ── 7. 权限（anon 全撤；authenticated 常规增删改查）──
REVOKE ALL ON public.attributes          FROM anon;
REVOKE ALL ON public.question_attributes FROM anon;
REVOKE ALL ON public.question_stats      FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attributes          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_attributes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_stats      TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 8. 回滚（如需；三表均为新增，DROP 后既有四表与数据完全不受影响）
-- ═══════════════════════════════════════════════════════════════════
-- DROP TABLE IF EXISTS public.question_stats;
-- DROP TABLE IF EXISTS public.question_attributes;
-- DROP TABLE IF EXISTS public.attributes;

-- 迁移完。执行后运行：node tools/import_attributes.mjs（写入 124 属性 + 698 题标注）
