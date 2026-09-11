/* #5 填空题判分 · 失败测试（先红后绿）
   直接 import 真实源码，不复制逻辑，避免"测了自己写的假实现"。 */
import { pathToFileURL } from 'node:url'

const SRC = 'C:/Users/青丘白浅/Documents/QoderCN/2026-09-02/chat-1/app/src/lib/validate.js'
const { gradeObjective, blanksOf } = await import(pathToFileURL(SRC).href)

/* UI 侧拼接方式：Practice.jsx 里 inputText = fills.join(SEP) */
const CASES = [
  ['斜杠答案 · 原样输入', 'PLC 的{I/O}模块负责信号交互', 'I/O', 'I/O', true],
  ['斜杠答案 · 小写', 'PLC 的{I/O}模块负责信号交互', 'I/O', 'i/o', true],
  ['斜杠答案 · 全角', 'PLC 的{I/O}模块负责信号交互', 'I/O', 'Ｉ／Ｏ', true],
  ['斜杠答案 · 带空格', 'PLC 的{I/O}模块负责信号交互', 'I/O', ' I/O ', true],
  ['AC/DC', '{AC/DC}变换器完成交直流转换', 'AC/DC', 'AC/DC', true],
  ['答案本体含空格', '该指令助记符是{MOV DF}', 'MOV DF', 'MOV DF', true],
  ['大小写不敏感', '可编程控制器的英文缩写是{PLC}', 'PLC', 'plc', true],
  ['两空 · 换行拼接', 'PLC 中文全称{可编程逻辑控制器}，采用{循环扫描}工作方式', '可编程逻辑控制器|循环扫描', '可编程逻辑控制器\n循环扫描', true],
  ['两空 · 逗号拼接(旧)', 'PLC 中文全称{可编程逻辑控制器}，采用{循环扫描}工作方式', '可编程逻辑控制器|循环扫描', '可编程逻辑控制器，循环扫描', true],
  ['单空答案本身含逗号', '该环节输入输出记作{输入,输出}', '输入,输出', '输入,输出', true],
  ['答错就该判错', '可编程控制器的英文缩写是{PLC}', 'PLC', 'XYZ', false],
  ['两空只填一空', 'PLC 中文全称{可编程逻辑控制器}，采用{循环扫描}工作方式', '可编程逻辑控制器|循环扫描', '可编程逻辑控制器', false],
  ['两空顺序颠倒', 'PLC 中文全称{可编程逻辑控制器}，采用{循环扫描}工作方式', '可编程逻辑控制器|循环扫描', '循环扫描\n可编程逻辑控制器', false]
]

let pass = 0
console.log('blanksOf 抽样: ' + JSON.stringify(blanksOf('PLC 的{I/O}模块')))
for (const [name, stem, answer, input, want] of CASES) {
  const q = { type: '填空题', stem, answer }
  let got, err = null
  try { got = gradeObjective(q, input) } catch (e) { err = e.message }
  const ok = !err && got.correct === want
  if (ok) pass++
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(22, ' ')} want=${String(want).padEnd(5)} ` +
    (err ? `throw ${err}` : `got=${got.correct} normalized=${JSON.stringify(got.normalized)} expected=${JSON.stringify(got.expected)}`)
  )
}
console.log(`\n${pass}/${CASES.length} 通过`)
