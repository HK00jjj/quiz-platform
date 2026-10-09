# src 备份说明（rev17 · 剔除 253 道冷门面试题）

- **内容**：scout346 体检报告 + 用户「保留常见必问、剔除冷门不常见」指令。全库 1274 题按面试常见度分级（必问254/常见375/偶见392/冷门253，依据五类真实面试题源锚清单 + 5 组并行评审 + 边界人工复核），剔除 253 道冷门题（岗位错位/主题无关/理论深水区/极偏细节），本书 1274→1021 题，全库 9265→9012。
- **执行链**：253 题完整行备份 + books value 备份 → DELETE questions（分批50）→ 回读零残留（9012）→ books.assign 同步清理（INC-20261008-04 纪律）→ 一致性校验（assign total=9012、本书=1021）→ bump rev 16→17 → export（rev17/9012）→ build → purge → deploy → push-src（本提交）→ VERIFY-LIVE-17。
- **产物**：tier/all_tiers.json（全量分级）、tier/remove_final.json（253 id+理由）、tier/backup_delete253_full.json（删除行全量备份）、tier/backup_books_before_delete253.json（assign 备份）、剔除清单报告 `装配调试维修面试题库_剔除清单_待确认.md`。
- **执行方式**：Supabase 遭遇 1.5h+ 长阻断窗口（SNI 特征重置，node/curl/代理全堵），由 watchdog_remove.mjs 无人值守穿窗执行全链。
