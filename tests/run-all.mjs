// 一键回归 runner（2026-09-09 经验对照 #1 的本地等价物）：
// CI 在 src 分支上自动跑同样的清单；本地部署前先跑这个，等价于 CI 的一次预演。
// 跑法：node tests/run-all.mjs   退出码 0=全绿，1=有失败
// （CI 上线前的过渡期，把它写进部署习惯：build 前必跑。）
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { existsSync } from 'fs'

const here = path.dirname(fileURLToPath(import.meta.url))
const appDir = path.resolve(here, '..')
const scriptsDir = path.resolve(appDir, '..', 'scripts')

const SUITE = [
  { name: '导入校验回归', cmd: 'node', args: ['tests/validate.regression.mjs'] },
  /* 2026-09-09 修复：组卷/填空/全局序三套脚本实际在 chat-1/scripts/（app 上一级），
     原路径 app/scripts/ 不存在 → existsSync 恒 false → 被静默跳过，回归形同虚设 */
  { name: '组卷行为回归', cmd: 'node', args: ['../scripts/t-session.mjs'] },
  { name: '能力选题回归', cmd: 'node', args: ['../scripts/t-ability.mjs'] },
  { name: '填空判分回归', cmd: 'node', args: ['../scripts/t-fill.mjs'] },
  { name: '全局序回归', cmd: 'node', args: ['../scripts/t-seq.mjs'] },
  { name: '闭环件回归（自由回忆+快照）', cmd: 'node', args: ['../scripts/t-closure.mjs'] },
  { name: '存储水位回归', cmd: 'node', args: ['tests/storage.regression.mjs'] }
]

let failed = 0
for (const s of SUITE) {
  const cwd = s.cwd ?? appDir
  const target = existsSync(path.join(cwd, s.args[0]))
  console.log(`▶ ${s.name} (${s.args[0]})${target ? '' : ' —— 脚本不存在，跳过'}`)
  if (!target) continue
  const r = spawnSync(s.cmd, s.args, { cwd, stdio: 'inherit' })
  if (r.status !== 0) { failed++; console.log(`✗ ${s.name} 失败 (exit ${r.status})`) }
}
console.log(failed === 0 ? '\nALL GREEN —— 可以走部署链' : `\n${failed} 个套件失败 —— 禁止部署`)
process.exit(failed === 0 ? 0 : 1)
