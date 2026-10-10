# rev20 发布备份说明（2026-10-10 深夜）

## 本次内容变更
- 新增 9 道问法级缺口题（10 路加强搜索驱动：变频器端子正反转/多段速电位器 K4×2、电机顺序启动/两地控制/凸轮控制器串电阻/起重机保护 K35×4、PLC 双线圈 K6×1、焊机电流调节 K1×1、焊机不引弧排查 K15×1，每题带 source 来源依据）
- 库总数：9030 → 9039；本书（b_l64s8t3lzb）assign：1039 → 1048
- rev：19 → 20

## 调研背景
用户令「加强搜索，全面搜索常问的面试题」→ 10 路并行搜索建立外部高频题锚清单 v2（30 个问法级锚）→ gap_check+gap_verify 双脚本对照 1039 题 → 确认 9 类真缺口（变频器端子/多段速/电位器、天车区整片空白、焊机区 0 覆盖、两地控制、顺序启动、双线圈）→ 命题 9 题补齐。

## 脚本与数据（E:/workbuddy-cc/2026-10-08-21-20-12/tier/）
- new9.json / new9_payload.json：命题数据与实际插入行
- insert9.mjs（首轮 8 题）+ continue_insert9.mjs（第 9 题续插+assign）：入库与结果 insert9_result.json
- gap_check.mjs / gap_verify.mjs：锚清单对照脚本
- backup_books_before_insert9.json：books 改前备份
- 注：insert9.mjs 的 id 生成循环条件曾漏改（ids.length<8），第 9 题 id 为 undefined 被 400 not-null 拦截——由 continue_insert9.mjs 修复闭环，教训同 INC-20261010-01（脚本批量改参数必须 grep 全量核对，禁 sed 单点替换）
