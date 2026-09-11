-- ═══════════════════════════════════════════════════════════════════
-- quiz-platform RLS 加固迁移（2026-09-11，GitHub 调研落实 · 单用户固定 auth.uid() 模板）
--
-- ⚠ 执行方式：Supabase Dashboard → SQL Editor，人工粘贴执行。
--   本机无 SQL 通道（REST 只有登录态 JWT，无 DDL 权限），无法自动应用。
--
-- 目的（使命排序：数据可信 > 展示好看）：
--   ① 四张表（questions / review_cards / answer_records / settings）全部收口为
--      "仅绑定教师账号"——封掉 settings 裸 upsert 自改段位、anon 残留写权限等路径；
--   ② 显式 WITH CHECK，防伪造 user_id / 越权 UPDATE（官方 RLS 蓝图五原则之 fail-closed）；
--   ③ 幂等：可重复执行（先 DROP 再 CREATE）。
--
-- 执行前两步（必做）：
--   1) 快照现有策略以便回滚：
--      SELECT schemaname, tablename, policyname, cmd, qual, with_check
--      FROM pg_policies WHERE schemaname = 'public';
--   2) 查教师账号 UUID 并全文件替换 <OWNER_UUID>：
--      SELECT id, email FROM auth.users;
--
-- 验证（执行后）：
--   a) 未登录（anon）REST 读 questions → 空数组/401；
--   b) 登录态（教师 JWT）读四表 → 数据正常（站点与 import_batch 等脚本均走
--      密码登录 JWT = authenticated 角色，不受影响）；
--   c) 尝试匿名 INSERT settings → RLS 拒绝。
--
-- 回滚：按第 1 步快照的策略重建（本文件只动策略，不动任何数据行）。
-- 列级答案隐藏（晋级赛服务端判分时启用，现为预留注释，见文件末尾）。
-- ═══════════════════════════════════════════════════════════════════

-- ── 0. 幂等清理：删掉四表上的全部旧策略（执行前先做快照！）──
-- pg_policies 是视图不可直接 DELETE，用动态 SQL 逐条 DROP：
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('questions', 'review_cards', 'answer_records', 'settings')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ── 1. 确保四表 RLS 已启用（幂等）──
ALTER TABLE public.questions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_cards   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings       ENABLE ROW LEVEL SECURITY;

-- ── 2. 教师账号全权策略（唯一的写入口；替代一切旧策略）──
-- 注意：行内不落 user_id 列（单租户表），USING/WITH CHECK 直接绑定固定 UUID——
-- 这是 Supabase 官方单用户模板的等价形式。执行前替换 <OWNER_UUID>！
CREATE POLICY owner_all_questions
  ON public.questions FOR ALL TO authenticated
  USING (auth.uid() = '<OWNER_UUID>')
  WITH CHECK (auth.uid() = '<OWNER_UUID>');

CREATE POLICY owner_all_review_cards
  ON public.review_cards FOR ALL TO authenticated
  USING (auth.uid() = '<OWNER_UUID>')
  WITH CHECK (auth.uid() = '<OWNER_UUID>');

CREATE POLICY owner_all_answer_records
  ON public.answer_records FOR ALL TO authenticated
  USING (auth.uid() = '<OWNER_UUID>')
  WITH CHECK (auth.uid() = '<OWNER_UUID>');

CREATE POLICY owner_all_settings
  ON public.settings FOR ALL TO authenticated
  USING (auth.uid() = '<OWNER_UUID>')
  WITH CHECK (auth.uid() = '<OWNER_UUID>');

-- ── 3. 撤销 anon（未登录）的一切表权限：匿名连读都不给 ──
-- 站点登录流程走 auth REST（不涉及表查询），撤销后登录前界面拉不到数据属预期；
-- 站点会在登录后才拉取题库（attach → loadAll）。
REVOKE ALL ON public.questions      FROM anon;
REVOKE ALL ON public.review_cards   FROM anon;
REVOKE ALL ON public.answer_records FROM anon;
REVOKE ALL ON public.settings       FROM anon;

-- ── 4. authenticated 的常规 GRANT（Supabase 默认已有，显式重申防被改）──
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_cards   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.answer_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings       TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 5.【预留·暂不启用】列级答案隐藏（晋级赛服务端判分 P3 落地时再开）
-- ═══════════════════════════════════════════════════════════════════
-- 原理（GitHub 调研实测确认的完整模式）：把 questions 的公开读取改走"无答案列视图"，
-- 表本体只留给 service_role（RPC/Edge Function），从而"题目可下发、答案永不下发"，
-- 从源头消灭"控制台看答案改段位"。
-- 暂不启用的原因：练习/复习判分目前是**客户端判分**，需要答案在浏览器里；
-- 直接启用会让练习页判分全挂。启用前置条件 = §3.2 考试判定 RPC 方案落地、
-- 且练习侧拆分出"练习视图（带答案，仍限 owner）与考试视图（无答案）"。
--
-- 启用步骤（届时）：
--   CREATE VIEW public.questions_public AS
--     SELECT id, seq, type, stem, options, difficulty, knowledge_point,
--            knowledge_domain, cognitive_level, explanation, image
--     FROM public.questions;
--   GRANT SELECT ON public.questions_public TO authenticated;
--   REVOKE ALL ON public.questions FROM authenticated;  -- 表本体只留 service_role
--   （应用侧 loadAll 改读视图；练习判分迁到练习视图或 RPC。）

-- 迁移完。执行后回到终端跑 verify 脚本与一次练习冒烟即可。
