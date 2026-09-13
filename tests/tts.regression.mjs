/* 解析播报 TTS 回归（2026-09-13 增量）
   覆盖 lib/tts.js 的三个纯函数（不触 DOM/浏览器 API，Node 直跑）：
   ① chunkSpeechText：切块上限（中文 50 字/块 ≈ ≤15s 阈值，规避 Chrome 长文 15s 中断 bug）、
      拼回等价（块连起来 = 清洗后原文，一个字不丢）、断点优先级、硬切兜底、空输入
   ② cleanSpeechText：emoji 删除、→ 与换行转停顿、markdown 记号剥离
   ③ pickVoice：选声优先级（晓晓Natural > 云希Natural > Natural > 常见微软本地音 > 任意zh） */
import assert from 'node:assert/strict'
import { chunkSpeechText, cleanSpeechText, pickVoice } from '../src/lib/tts.js'

let n = 0
const ok = (cond, msg) => { n++; assert.ok(cond, msg) }

/* ── ① 切块 ── */
// 1) 空输入恒空
ok(chunkSpeechText('').length === 0, '①-1 空串 → 空块')
ok(chunkSpeechText(undefined).length === 0, '①-2 undefined → 空块')
ok(chunkSpeechText('   \n  ').length === 0, '①-3 纯空白 → 空块')

// 2) 上限：块长永不超 max（含超长无标点句的硬切兜底）
const longNoPunct = '长'.repeat(233)
ok(chunkSpeechText(longNoPunct).every((c) => c.length <= 50), '①-4 无标点超长句硬切 ≤50')
ok(chunkSpeechText(longNoPunct).join('') === '长'.repeat(233), '①-5 硬切不丢字')

// 3) 拼回等价：多段落混合文本切块后连起来 = 清洗后原文（一个字不丢）
const mixed = '第一步合上QS。观察KM1是否吸合，若吸合则主回路正常；若不吸合！检查控制回路。\n用万用表测量线圈电压→应为380V。'
ok(chunkSpeechText(mixed).join('') === cleanSpeechText(mixed), '①-6 拼回等价（含换行/箭头清洗）')
ok(chunkSpeechText(mixed).every((c) => c.length <= 50), '①-7 混合文本所有块 ≤50')

// 4) 断点优先级：单句超长时在次级断点（，、：）回退切，切点落在断点后
const longSentence = '这是一个特别长的句子没有句号但是有逗号，逗号之后还有很长很长的内容继续往下延伸，一直延伸到超过五十个字的切块上限为止，看看切块函数会把它切在哪里'
const cs = chunkSpeechText(longSentence)
ok(cs.every((c) => c.length <= 50), '①-8 次级断点切块 ≤50')
ok(cs.join('') === cleanSpeechText(longSentence), '①-9 次级断点切块不丢字')
ok(cs.some((c) => c.endsWith('，')), '①-10 至少一块以逗号收尾（断点回退生效，非纯硬切）')

// 5) 短句合并：多个短句合进同一块（减少引擎块间机械停顿）
const shorts = '对。错。对。错。对。错。对。错。对。错。'
ok(chunkSpeechText(shorts).length === 1, '①-11 短句就近合并为一块')
ok(chunkSpeechText(shorts)[0].length <= 50, '①-12 合并块仍不超上限')

// 6) 英文/数字混排不炸
ok(chunkSpeechText('Motor rated current is 12.5A, and the insulation class is F. 测量绝缘电阻应大于0.5MΩ。').every((c) => c.length <= 50), '①-13 中英数混排切块正常')

/* ── ② 清洗 ── */
ok(!/[✦★✓✗]/u.test(cleanSpeechText('✦ 连击 ✓ 答对 ✗')), '②-1 装饰符/对错符删除')
ok(cleanSpeechText('按SB2→KM吸合') === '按SB2，KM吸合', '②-2 箭头转停顿')
ok(cleanSpeechText('第一行\n第二行') === '第一行，第二行', '②-3 换行转停顿')
ok(cleanSpeechText('**重点**与`代码`') === '重点与代码', '②-4 markdown 记号剥离')
ok(cleanSpeechText('正常文字保持不变') === '正常文字保持不变', '②-5 正常文字原样')
ok(cleanSpeechText('，连续逗号，') === '，连续逗号，', '②-6 连续停顿不误伤正常标点')

/* ── ③ 选声 ── */
const V = (name, lang = 'zh-CN', localService = false) => ({ name, lang, localService })
ok(pickVoice([V('Microsoft Huihui'), V('Microsoft Xiaoxiao Online (Natural) - Chinese (Simplified)'), V('Microsoft Yaoyao')]).name.includes('Xiaoxiao') , '③-1 晓晓 Natural 最高优先')
ok(pickVoice([V('Microsoft Huihui'), V('Microsoft Yunxi Online (Natural)')]).name.includes('Yunxi'), '③-2 云希 Natural 次优先')
ok(pickVoice([V('Microsoft Yaoyao'), V('Microsoft Yunyang Online (Natural) - Chinese (Simplified)')]).name.includes('Yunyang'), '③-3 其他 Natural 第三')
ok(pickVoice([V('Microsoft Yaoyao'), V('Google 普通话（中国大陆）')]).name.includes('Yaoyao'), '③-4 常见微软本地音优先于 Google 音')
ok(pickVoice([V('Some Voice', 'en-US'), V('Google 普通话（中国大陆）')]).name.includes('普通话'), '③-5 无微软系回落任意 zh')
ok(pickVoice([V('Samantha', 'en-US')]) === null, '③-6 无 zh 音 → null（交浏览器按 lang 默认）')
ok(pickVoice([]) === null, '③-7 空列表 → null')

console.log(`\ntts.regression：${n} 断言全绿`)
