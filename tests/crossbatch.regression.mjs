/* crossBatchCheck 知识点分桶预筛 · 回归锁（2026-09-11 GitHub 调研 §4.6 落实）
   锁定分桶后的语义边界：
   - 同知识点桶内近似题干 → 照旧告警（分桶不能丢真重复）；
   - 跨知识点 → 不再比对（近似改写必然保留同一考点，跨桶相似只是模板句式）；
   - 新题无知识点 → 回退全库比对（旧行为兜底）；
   - 库内无知识点题 → 永远参与比对；
   - 内容哈希命中的重复导入 → 照旧整题跳过。
   跑法：node tests/crossbatch.regression.mjs */
import { pathToFileURL, fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const { crossBatchCheck, hashId } = await import(pathToFileURL(path.join(here, '..', 'src', 'lib', 'validate.js')).href)

let pass = 0
const fails = []
const ok = (name, cond, detail = '') => {
  if (cond) pass++
  else fails.push(`  FAIL ${name} ${detail}`)
}
const hasStemWarn = (warns) => warns.some((w) => w.message.includes('题干与库内已有题高度相似'))
const hasKpWarn = (warns) => warns.some((w) => w.message.includes('与库内已有题同名'))

/* 库内题：S1/S2 同属「电气互锁」桶，S3 属「PLC基础」桶，S4 无知识点。
   id 必须用真实 hashId(stem,type,answer) 生成——重复导入跳过的判据就是它（线上同构）。 */
const BANK = [
  { id: hashId('电动机星三角启动时热继电器应接在三角形运行回路中', '单选题', 'A'), stem: '电动机星三角启动时热继电器应接在三角形运行回路中', type: '单选题', answer: 'A', knowledgePoint: '电气互锁' },
  { id: hashId('接触器联锁正反转控制线路中两个接触器的常闭触点必须互相串联在对方线圈回路', '判断题', '正确'), stem: '接触器联锁正反转控制线路中两个接触器的常闭触点必须互相串联在对方线圈回路', type: '判断题', answer: '正确', knowledgePoint: '电气互锁' },
  { id: hashId('PLC 的扫描工作方式分为输入采样、程序执行和输出刷新三个阶段', '单选题', 'B'), stem: 'PLC 的扫描工作方式分为输入采样、程序执行和输出刷新三个阶段', type: '单选题', answer: 'B', knowledgePoint: 'PLC基础' },
  { id: hashId('兆欧表测量低压电机绕组对地绝缘电阻前必须先对被测设备放电并验电', '判断题', '正确'), stem: '兆欧表测量低压电机绕组对地绝缘电阻前必须先对被测设备放电并验电', type: '判断题', answer: '正确', knowledgePoint: '' }
]
/* 与 q_1 近似改写（仅个别字差异，2-gram 重叠系数远超 0.8） */
const NEAR_S1 = '电动机星三角启动时热继电器应装在三角形运行回路里'
const RAW = (题干, 知识点) => ({ 序号: 1, 题型: '单选题', 题干, 答案: 'C', 知识点, 选项: ['A. x', 'B. y', 'C. z', 'D. w'] })

/* 1 同桶近似 → 告警（分桶不丢真重复） */
ok('1a 同知识点近似改写 → 题干相似告警',
  hasStemWarn(crossBatchCheck([RAW(NEAR_S1, '电气互锁')], BANK)))
ok('1b 同知识点同名 → 知识点撞名告警仍在',
  hasKpWarn(crossBatchCheck([RAW('完全不同的题干内容关于断相保护', '电气互锁')], BANK)))

/* 2 跨桶 → 不比对（不再产生题干告警；模板句式本就该由护栏压制） */
ok('2 跨知识点相似模板 → 不出题干告警',
  !hasStemWarn(crossBatchCheck([RAW(NEAR_S1, 'PLC基础')], BANK)))

/* 3 新题无知识点 → 回退全库比对 */
ok('3a 无知识点新题也能命中桶内近似题（全库回退）',
  hasStemWarn(crossBatchCheck([RAW(NEAR_S1, '')], BANK)))
ok('3b 无知识点新题能命中库内无知识点题',
  hasStemWarn(crossBatchCheck([RAW('兆欧表测量低压电机绕组对地绝缘电阻前应先对设备放电并验电', '')], BANK)))

/* 4 库内无知识点题永远参与比对（新题带任意知识点也照比） */
ok('4 库内无知识点题不受分桶影响',
  hasStemWarn(crossBatchCheck([RAW('兆欧表测量低压电机绕组对地绝缘电阻前应先对设备放电并验电', '电气仪表使用')], BANK)))

/* 5 内容哈希命中（重复导入）→ 整题跳过无告警 */
const DUP = { 序号: 1, 题型: '单选题', 题干: '电动机星三角启动时热继电器应接在三角形运行回路中', 答案: 'A', 知识点: '电气互锁', 选项: ['A. x', 'B. y', 'C. z', 'D. w'] }
ok('5 重复导入同题 → 无任何告警',
  crossBatchCheck([DUP], BANK).length === 0)

/* 6 同桶但内容不相似 → 只有知识点告警、无题干告警 */
{
  const warns = crossBatchCheck([RAW('关于自耦变压器降压启动的接线要点与适用场合选择', '电气互锁')], BANK)
  ok('6 同桶不相似 → 只有知识点告警', hasKpWarn(warns) && !hasStemWarn(warns))
}

/* 7 性能口径：1481 库 × 200 新题规模量级跑得动（粗断言 < 2s，旧行为同机 > 8s） */
{
  const bigBank = []
  for (let i = 0; i < 1481; i++) {
    bigBank.push({ id: 'b' + i, stem: `第${i}题：三相异步电动机的转差率计算与额定电流估算题干填充内容${i}号`, type: '单选题', answer: 'A', knowledgePoint: 'kp桶' + (i % 40) })
  }
  const batch = []
  for (let i = 0; i < 200; i++) batch.push(RAW(`新题干内容各不相同关于接触器使用类别第${i}题`, 'kp桶' + (i % 40)))
  const t0 = Date.now()
  crossBatchCheck(batch, bigBank)
  const dt = Date.now() - t0
  ok(`7 分桶后 200×1481 规模耗时 ${dt}ms < 2000ms`, dt < 2000)
}

console.log(`分桶预筛回归：${pass} 项通过${fails.length ? '，' + fails.length + ' 项失败' : ''}`)
if (fails.length) { console.log(fails.join('\n')); process.exit(1) }
