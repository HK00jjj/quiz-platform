// 存储水位监测回归（2026-09-09 经验对照 #2 配套）。
// 只测纯函数 assessEntries（estimateStorage 的核心逻辑与它一致，分离开以便 Node 直跑）。
// 跑法：node tests/storage.regression.mjs   退出码 0=全过，1=有失败
import { assessEntries, SOFT_LIMIT, HARD_LIMIT, fmtBytes } from '../src/lib/storageQuota.js'

let pass = 0, fail = 0
function t(name, cond) {
  if (cond) { pass++; console.log('  PASS ' + name) }
  else { fail++; console.log('  FAIL ' + name) }
}

const e = (k, bytes) => ({ key: k, bytes })

// 1. 空存储 → ok 级，0 字节
{
  const r = assessEntries([])
  t('空存储 ok / 0 字节', r.level === 'ok' && r.bytes === 0)
  t('空存储 biggestKey 为 null', r.biggestKey === null)
}

// 2. 阈值下方 → ok
{
  const r = assessEntries([e('a', SOFT_LIMIT - 1024)])
  t('低于软阈值 → ok', r.level === 'ok')
}

// 3. 跨过软阈值 → warn
{
  const r = assessEntries([e('a', SOFT_LIMIT), e('b', 100)])
  t('达到软阈值 → warn', r.level === 'warn')
}

// 4. 跨过硬阈值 → danger
{
  const r = assessEntries([e('qp.imgmap.v1', HARD_LIMIT)])
  t('达到硬阈值 → danger', r.level === 'danger')
  t('最大占用键识别正确', r.biggestKey === 'qp.imgmap.v1')
}

// 5. 字节合计与最大键（多键）
{
  const r = assessEntries([e('k1', 500), e('k2', 900), e('k3', 100)])
  t('字节合计 1500', r.bytes === 1500)
  t('最大键 k2', r.biggestKey === 'k2' && r.biggestBytes === 900)
}

// 6. 恰好等于硬阈值算 danger（>= 语义，逼近上限必须拦）
{
  const r = assessEntries([e('a', HARD_LIMIT - 1)])
  t('硬阈值-1 → warn（不含边界）', r.level === 'warn')
}

// 7. fmtBytes 三个量级
t('fmtBytes MB', fmtBytes(3 * 1024 * 1024) === '3.00 MB')
t('fmtBytes KB', fmtBytes(4096) === '4.0 KB')
t('fmtBytes B', fmtBytes(512) === '512 B')

console.log(`\nregression: ${pass} pass, ${fail} fail`)
process.exit(fail === 0 ? 0 : 1)
