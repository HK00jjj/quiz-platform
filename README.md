# rev18 发布备份说明（2026-10-09）

## 本次内容变更
- 新增 10 道高频补充题（来源：7 路联网调研缺口分析；半导体 4 + 锂电 3 + 机器人 1 + 视觉 1 + SMT 1）
- 修正 2 道存量形态残留题（q_118zsfp 填空→简答 RobotStudio；q_5awq9s 单选→简答氦质谱检漏三步法）
- 库总数：9012 → 9022；本书（b_l64s8t3lzb）assign：1021 → 1031
- rev：17 → 18

## 相关脚本与备份（E:/workbuddy-cc/2026-10-08-21-20-12/tier/）
- new10.json：10 题命题数据（含 source 来源依据字段）
- new10_payload.json：实际插入的完整行
- insert10.mjs / insert_result.json：入库脚本与结果（新题 id 清单）
- backup_books_before_insert10.json：books settings 改前备份
- backup_fix2_before.json：2 道存量题改前完整行
- watchdog_insert10.mjs / watchdog_run.log / watchdog_result.json：开窗看门狗（假证书劫持期）

## 来源依据
详见《装配调试维修面试题库_补题10道_来源依据报告.md》（同目录上级）
