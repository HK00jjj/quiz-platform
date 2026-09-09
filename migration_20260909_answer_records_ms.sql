-- answer_records 数据底座扩展（v4.15.1，2026-09-09）
-- 目的：为将来的 IRT 离线标定与速度-准确率计分积累作答时长。
-- 执行方式：Supabase Dashboard → SQL Editor（anon key 无 DDL 权限，必须控制台人工执行）。
--
-- 设计说明：
-- 1. 只加 ms 一列。"picked"（用户所选项）经审查确认已由 detail 列承载
--    （store.js confirmObjective 写入 lastGrade.normalized，即规范化后的作答），
--    不重复建列。
-- 2. 本 SQL 执行前后客户端均可安全运行：
--    - 执行前：db.js 的 insert/rpc payload 不含 ms（客户端已在 store.js 本地记录 ms，
--      云端四字段语义不变）——本机 records 为真源，云端只是备份。
--    - 执行后（可空列，历史行 NULL）：需要让云端开始接收 ms 时，第二步再改
--      db.js persistAnswer / replace_progress 的 payload 加 ms: record.ms ?? null；
--      若 replace_progress RPC 的 payload 处理是固定列列表，需同步重建该函数。
-- 3. ms 语义：从题卡入场（phase 变 answering）到确认作答的总毫秒数，
--      含约 360ms 翻牌入场动画；中断折算的记录无独立计时，取 0。
-- 4. 字段历史：本列上线前（<2026-09-09）的本地备份 JSON 无 ms 字段，
--      恢复/合库时代码按缺失容忍（r.ms ?? null），无需回填。

alter table public.answer_records
  add column if not exists ms integer;

comment on column public.answer_records.ms is
  '作答时长（毫秒，题卡入场到确认，含约360ms翻牌动画）；2026-09-09 前的历史记录为 NULL';
