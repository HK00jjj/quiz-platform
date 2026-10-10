# rev21 部署说明（全面质量审查修复 31 题）

- 时间：2026-10-11 凌晨
- 背景：用户要求全面审查本书 1048 题（题干-选项匹配 / 现场面试符合度 / 真实正确）。全量结构审查 + 选择题全读 + 内容抽样 121 题后，发现 27 ERROR + 5 WARN，用户确认「全部上线」。
- 修复 31 条 PATCH（脚本 tier/fix31.mjs，备份 backup_fix31_before.json，终验 FIX31 ALL GREEN）：
  - A 类·判断题 answer 语义翻转 11 条（8 条 正确→错误：q_1463bqi/q_16aonoy/q_1dr2a39/q_1yhd3vy/q_43o1r7/q_dhqech/q_mgu3zi/q_q261q0；3 条 错误→正确：q_19fwkx4/q_1bpf495/q_74c9v4）——疑问句判断题 answer 应为「对疑问句的直接应答」，这批标反，学员点按钮被教反；解析无需改（解析讲的全是事实）。
  - B 类·题干问法修正 3 条（q_becev9 齿轮传动改「错误的是」、q_fug7lg 裸电芯改「不属于」、q_fsurti 通信介质改「不属于」）——出题人本意即排除式问法，解析早已写明「选C」，仅题干写反。
  - C 类·简答 answer 补全 13 条（q_1qq57le/q_1pzjfme/q_1w3xygl/q_3zztv5/q_1j3qszc/q_1e2yr0a/q_13yf2ua/q_mxb9fi/q_1x5ywl1/q_tnbk5s/q_1cxslyd/q_1ayu62e 多问缺答补全；q_1q07dpg M20 膨胀螺丝打孔 12→25mm 并同步改解析——12mm 连 M20 螺杆都插不进）。
  - D 类·形态清理 4 条（q_5awq9s options 置 null；q_9ls2p9/q_4wsj1i/q_1u6t1kx answer 补全/加单位）。
- 审查方法论沉淀：①疑问句判断题入库校验应加「answer 语义=疑问句直接应答」自检（解析结论方向必须与 answer 一致）——此模式错误 rev17~20 口语化审计未覆盖，是盲区；②「一题多问分号短答」为本书简答正常形态，勿误判为残缺（判据=题干每个小问都有对应答案段）。
- rev 链：bump 20→21 → export（rev21/9039/16.28MB）→ 抽查 31/31 生效 → build 11.03s → purge → deploy commit 3e05cf96 → push-src-diff 本提交。
- 红线提醒（继承 rev20）：脚本批量改参数必须 grep 全量核对；4xx 立即失败；fetch 全局 30s 超时。
