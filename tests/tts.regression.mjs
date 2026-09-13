/* 解析播报 TTS 回归（2026-09-13 增量）
   覆盖 lib/tts.js 的三个纯函数（不触 DOM/浏览器 API，Node 直跑）：
   ① chunkSpeechText：切块上限（中文 50 字/块 ≈ ≤15s 阈值，规避 Chrome 长文 15s 中断 bug）、
      拼回等价（块连起来 = 清洗后原文，一个字不丢）、断点优先级、硬切兜底、空输入
   ② cleanSpeechText：emoji 删除、→ 与换行转停顿、markdown 记号剥离
   ③ pickVoice：选声优先级（晓晓Natural > 云希Natural > Natural > 常见微软本地音 > 任意zh） */
import assert from 'node:assert/strict'
import { chunkSpeechText, cleanSpeechText, pickVoice, chunkMaxFor, TTS_RATE, RATE_MIN, RATE_MAX, RATE_STEP, clampRate, fmtRate, ttsRate, sliceForResume } from '../src/lib/tts.js'

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

/* ── ③ 选声（2026-09-13 晚按真机对拍修正顺序后重写）── */
const V = (name, lang = 'zh-CN', localService = false) => ({ name, lang, localService })
const XIAOXIAO = 'Microsoft 晓晓 Online (Natural) - Chinese (Mandarin, Simplified)'
const YUNXI = 'Microsoft 云希 Online (Natural) - Chinese (Mandarin, Simplified)'
const YUNYANG = 'Microsoft 云扬 Online (Natural) - Chinese (Mandarin, Simplified)'
ok(pickVoice([V('Microsoft Huihui'), V(XIAOXIAO), V('Microsoft Yaoyao')]).name.includes('晓晓'), '③-1 晓晓 Natural 最高优先（中文名，Edge 本地化命名）')
ok(pickVoice([V('Microsoft Huihui'), V(YUNXI)]).name.includes('云希'), '③-2 云希 Natural 次优先')
ok(pickVoice([V('Microsoft Huihui'), V(YUNYANG)]).name.includes('云扬'), '③-3 其他 Online 神经音第三')
ok(pickVoice([V('Microsoft Huihui'), V('Microsoft Xiaoxiao Online (Natural) - Chinese (Simplified)')]).name.includes('Xiaoxiao'), '③-3b 拉丁名形式同样命中（Chrome 系命名）')
/* 关键修正：无神经音时，Google 网络音必须排在本地 SAPI5 之前（实证：SAPI 电子感强） */
ok(pickVoice([V('Microsoft Huihui'), V('Microsoft Yaoyao'), V('Google 普通话（中国大陆）')]).name.includes('Google'), '③-4 无神经音时 Google 网络音优先于微软本地 SAPI')
ok(pickVoice([V('Microsoft Huihui'), V('Microsoft Yaoyao')]).name.includes('Huihui'), '③-5 连 Google 都没有才回落本地 SAPI')
/* 方言/腔调收口：粤语、台湾腔、官话方言不得被当作普通话选中 */
ok(pickVoice([V('Microsoft Huihui'), V('Microsoft 曉曼 Online (Natural) - Chinese (Cantonese, Traditional)', 'zh-HK'), V('Microsoft 曉臻 Online (Natural) - Chinese (Taiwanese Mandarin, Traditional)', 'zh-TW')]).name.includes('Huihui'), '③-6 粤语/台湾腔神经音不抢占普通话（回落 zh-CN）')
ok(pickVoice([V('Microsoft 晓北 Online (Natural) - Chinese (Northeastern Mandarin, Simplified)', 'zh-CN-liaoning'), V(YUNXI)]).name.includes('云希'), '③-7 东北官话变体不参与普通话优先池')
ok(pickVoice([V('Microsoft 曉曼 Online (Natural) - Chinese (Cantonese, Traditional)', 'zh-HK')]).name.includes('曉曼'), '③-8 机器只有粤语音时仍可用（兜底不空）')
ok(pickVoice([V('Some Voice', 'en-US'), V('Google 普通话（中国大陆）')]).name.includes('普通话'), '③-9 无微软系回落任意普通话（含 Google）')
ok(pickVoice([V('Samantha', 'en-US')]) === null, '③-10 无 zh 音 → null（交浏览器按 lang 默认）')
ok(pickVoice([]) === null, '③-11 空列表 → null')

/* ── ④ 块长分流（2026-09-13 晚：用户实测"读一下就换音色"的对策之一）──
   Edge Online 神经音走云端长文本引擎 → 放宽到 180 字（少切几刀 = 少几次块边界）；
   其余（Chrome Google 网络音 / 本地 SAPI）保持 50 字，规避 Chrome 桌面 ~15s 静默中断。 */
const ONLINE_NATURAL = V(XIAOXIAO, 'zh-CN', false)
ok(chunkMaxFor(ONLINE_NATURAL) === 180, '④-1 Online 神经音块长放宽 180')
ok(chunkMaxFor(V('Microsoft Huihui', 'zh-CN', true)) === 50, '④-2 本地 SAPI 保持 50')
ok(chunkMaxFor(V('Google 普通话（中国大陆）', 'zh-CN', false)) === 50, '④-3 Google 网络音保持 50（Chrome 有长文静默 bug）')
ok(chunkMaxFor(null) === 50, '④-4 无音色时保守取 50')
const longText = '解析'.repeat(120)
ok(chunkSpeechText(longText, chunkMaxFor(ONLINE_NATURAL)).length < chunkSpeechText(longText, 50).length, '④-5 同一长文在 180 分块下块数更少')

/* ── ⑤ 语速：自定义（无档位）+ 默认 1.35（用户 2026-09-13 晚第四轮定稿）── */
ok(TTS_RATE === 1.35, '⑤-1 默认语速 1.35（未设置偏好时）')
ok(RATE_MIN === 0.5 && RATE_MAX === 2, '⑤-2 自定义区间 0.5~2.0（引擎上限 2.0，超了会失真/卡死）')
ok(clampRate(1.42) === 1.42, '⑤-3 任意自定义值原样通过（1.42）')
ok(clampRate(0.2) === 0.5, '⑤-4 低于下限夹到 0.5')
ok(clampRate(9) === 2, '⑤-5 高于上限夹到 2.0')
ok(clampRate('1.137') === 1.14, '⑤-6 字符串入参 + 两位小数取整')
ok(clampRate('abc') === TTS_RATE, '⑤-7 非法入参回落默认 1.35')
ok(ttsRate() === 1.35, '⑤-8 Node 无 window 环境取默认值且不抛错（回归脚本可直接跑）')
/* 真机实测（2026-09-13 晚）：步进 0.05 时滑块把 1.42 吸附成 1.40（网格 0.5+0.05n），
   既然要"自定义、不要预设"，步进收细到 0.01 并加显示格式化 */
ok(RATE_STEP === 0.01, '⑤-9 滑块步进 0.01（任意百分位可调，不被网格吸附）')
ok(clampRate(1.42) === 1.42, '⑤-10 1.42 这类自定义值完整保留')
ok(fmtRate(1.4) === '1.4' && fmtRate(1.35) === '1.35' && fmtRate(1.42) === '1.42', '⑤-11 显示格式化去浮点尾巴')

/* ── ⑥ 暂停/续播位置（用户指令 2026-09-13 晚：开关都暂停在原处、不重复读）──
   session.i = 已开口的块数 → 被打断的是 i-1，续播从它开始贪吃，绝不整段重来 */
ok(JSON.stringify(sliceForResume({ chunks: ['a', 'b', 'c'], i: 2 })) === JSON.stringify(['b', 'c']), '⑥-1 续播从被打断的那块起（已读完的 a 不重读）')
ok(JSON.stringify(sliceForResume({ chunks: ['a', 'b', 'c'], i: 1 })) === JSON.stringify(['a', 'b', 'c']), '⑥-2 首块就被打断则仍从整段（无更早进度可续）')
ok(sliceForResume(null).length === 0, '⑥-3 无会话（换题/停止后）返回空，不会误从头读')
ok(sliceForResume({ chunks: [], i: 3 }).length === 0, '⑥-4 空块表返回空')

console.log(`\ntts.regression：${n} 断言全绿`)
