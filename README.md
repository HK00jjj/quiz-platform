# rev19 发布备份说明（2026-10-10）

## 本次内容变更
- 新增 8 道设备四连问缺口题（覆盖度审计驱动；软启动器 2 K4 / 电动葫芦 2 K35 / 变频器调试 2 K4 / 直流电机 1 K3 / 单相电机 1 K35，每题带 source 来源依据）
- 库总数：9022 → 9030；本书（b_l64s8t3lzb）assign：1031 → 1039
- rev：18 → 19

## 审计背景
用户问「面试指设备四连问（是什么/接线/调试/维修）是否覆盖现场常用设备」→ 对本书 1031 题做设备实体×四问维度矩阵审计（tier/audit_device2.mjs），发现设备级缺口（软启动器 2 题/行吊 1 题/UPS 1 题/直流 4 题无接线/单相 3 题无维修调试）与维度级缺口（调试仅 20%），按建议逐项补 8 题。

## 相关脚本与备份（E:/workbuddy-cc/2026-10-08-21-20-12/tier/）
- new8.json / new8_payload.json：命题数据与实际插入行
- insert8.mjs / insert8_result.json：入库脚本（含字段值域预校验 + 4xx 立即失败）与结果
- audit_device.mjs / audit_device2.mjs / audit_device_result.json / book_1031.json：审计脚本与数据
- backup_books_before_insert8.json：books settings 改前备份
