/* 解析播报 TTS 回归（2026-09-13 增量）
   覆盖 lib/tts.js 的三个纯函数（不触 DOM/浏览器 API，Node 直跑）：
   ① chunkSpeechText：切块上限（中文 50 字/块 ≈ ≤15s 阈值，规避 Chrome 长文 15s 中断 bug）、
      拼回等价（块连起来 = 清洗后原文，一个字不丢）、断点优先级、硬切兜底、空输入
   ② cleanSpeechText：emoji 删除、→ 与换行转停顿、markdown 记号剥离
   ③ pickVoice：选声优先级（晓晓Natural > 云希Natural > Natural > 常见微软本地音 > 任意zh） */
import assert from 'node:assert/strict'
import { chunkSpeechText, cleanSpeechText, normalizeSpeech, pickVoice, chunkMaxFor, TTS_RATE, RATE_MIN, RATE_MAX, RATE_STEP, clampRate, fmtRate, ttsRate, sliceForResume, listVoices, voiceQualityOf, voiceAccent, voiceLabel, ttsVoicePref, resolveVoiceByName } from '../src/lib/tts.js'

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
ok(chunkMaxFor(ONLINE_NATURAL) === 180, '④-1 Online 神经音块长 180（少切几刀、语调连贯）')
ok(chunkMaxFor(V('Microsoft Huihui', 'zh-CN', true)) === 50, '④-2 本地 SAPI 保持 50')
ok(chunkMaxFor(V('Google 普通话（中国大陆）', 'zh-CN', false)) === 70, '④-3 Google 网络音放宽到 70（原 50 太碎，听感更机械）')
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

/* ── ⑦ 音色分档与全量中文音色清单（2026-09-14：用户要求"所有中文音都放进去自由选"）──
   现实约束：Chrome 只暴露 3 个老 SAPI 中文音，晓晓/云希这类 Online 神经音只有 Edge 有。 */
ok(voiceQualityOf(V(XIAOXIAO, 'zh-CN', false)) === 'natural', '⑦-1 Online 神经音 → natural')
ok(voiceQualityOf(V('Google 普通话（中国大陆）', 'zh-CN', false)) === 'network', '⑦-2 Google 系列 → network')
ok(voiceQualityOf(V('Microsoft Huihui', 'zh-CN', true)) === 'sapi', '⑦-3 Huihui → sapi（机械感强那一档）')
ok(voiceQualityOf(V('Microsoft Huihui', 'zh-CN', false)) === 'sapi', '⑦-3b Huihui 即使 localService=false 也判 sapi（名字优先，防误判成网络音）')
ok(voiceQualityOf(null) === 'none', '⑦-4 无声 → none')
const CANTON = V('Microsoft 曉曼 Online (Natural) - Chinese (Cantonese, Traditional)', 'zh-HK')
const TAIWAN = V('Microsoft 曉臻 Online (Natural) - Chinese (Taiwanese Mandarin, Traditional)', 'zh-TW')
const DONGBEI = V('Microsoft 晓北 Online (Natural) - Chinese (Northeastern Mandarin, Simplified)', 'zh-CN-liaoning')
const LV = listVoices([V('Microsoft Huihui'), V('Google 普通话（中国大陆）'), V(XIAOXIAO), CANTON, TAIWAN, DONGBEI])
ok(LV.length === 6, '⑦-5 全量收录：粤语/台湾/方言都进列表（不再过滤）')
ok(LV[0].quality === 'natural' && LV[0].accent === '', '⑦-6 普通话神经音置顶，且不带腔调标签')
ok(LV[LV.length - 1].accent !== '', '⑦-7 方言/其它腔调排最后（但不隐藏）')
ok(voiceAccent(CANTON) === '粤语' && voiceAccent(TAIWAN) === '台湾', '⑦-8 腔调识别：粤语 / 台湾')
ok(voiceAccent(DONGBEI) === '东北', '⑦-9 方言识别：东北官话')
ok(/粤语/.test(voiceLabel(CANTON)) && /★自然/.test(voiceLabel(CANTON)), '⑦-10 下拉文案含腔调与质量标签')
ok(/晓晓/.test(voiceLabel(V(XIAOXIAO))) && !/Microsoft|Chinese|Online/.test(voiceLabel(V(XIAOXIAO))), '⑦-11 文案去掉厂商与冗长尾巴')
ok(ttsVoicePref() === null, '⑦-12 Node 无 window 时音色偏好取 null 且不抛错')
/* ⑧ 整段锁定同一音色（Edge 首帧只给老 SAPI 音、异步补齐神经音 → 旧实现"每块各自 pickVoice"
   会造成前几块机械音/后面换音色） */
const VS = [V('Microsoft Huihui'), V(YUNXI), V(XIAOXIAO)]
ok(resolveVoiceByName(VS, YUNXI)?.name.includes('云希') === true, '⑧-1 按名字取回同一音色')
ok(resolveVoiceByName(VS, '不存在的音色') === null, '⑧-2 名字失效返回 null（回退当前最优）')
ok(resolveVoiceByName([], null) === null, '⑧-3 无名字/空表安全返回 null')
/* ⑧-b 默认音色＝云健（用户 2026-09-15 指定）；有显式选择时仍以用户选择优先 */
const YUNJIAN = V('Microsoft 云健 Online (Natural) - Chinese (Mandarin, Simplified)', 'zh-CN', false)
ok(pickVoice([V(XIAOXIAO), YUNXI, YUNJIAN])?.name === YUNJIAN.name, '⑧-4 自动档首选云健')
ok(pickVoice([V(XIAOXIAO), YUNXI])?.name.includes('晓晓') === true, '⑧-5 无云健时回落晓晓（顺序未坏）')

/* ── ⑨ 播报读法归一化（2026-09-14 晚：用户报"播报有错别音"，全库取证后修）──
   原则：只改"送引擎的副本"，屏幕原文不动。数据：单位/数学符号 4811 处、希腊字母 1686 处。 */
ok(normalizeSpeech('3750Ω') === '3750欧姆', '⑨-1 Ω → 欧姆')
ok(normalizeSpeech('3.75kΩ') === '3.75千欧' && normalizeSpeech('1.5MΩ') === '1.5兆欧', '⑨-2 kΩ/MΩ 复合单位优先于 Ω')
ok(normalizeSpeech('0.22μF') === '0.22微法' && normalizeSpeech('200μA') === '200微安', '⑨-3 μF/μA → 微法/微安')
ok(normalizeSpeech('25℃') === '25摄氏度' && normalizeSpeech('25°C') === '25摄氏度', '⑨-4 摄氏度两种写法')
ok(normalizeSpeech('±5%') === '正负5%' && normalizeSpeech('≥1.5') === '大于等于1.5' && normalizeSpeech('≈0.8') === '约等于0.8', '⑨-5 ± / ≥ / ≈')
ok(normalizeSpeech('3×4') === '3乘4', '⑨-6 × → 乘')
ok(normalizeSpeech('τ=RC') === '套=RC' && normalizeSpeech('φ角') === '斐角', '⑨-7 希腊字母按工程口语译名读')
ok(normalizeSpeech('AC/DC') === 'AC 或 DC' && normalizeSpeech('I/O') === 'I 或 O', '⑨-8 斜杠组合读成"或"（引擎念"斜杠"或直接吞掉）')
/* ⑩ 内部标注不得入读（全库 1475 处 [错因:…] + 9318 处【】标签） */
ok(!/\[错因/.test(cleanSpeechText('【误诊】A「短路」错。[错因:概念缺失]')), '⑩-1 [错因:…] 内部标签被剥掉，不会念出来')
ok(cleanSpeechText('【概念】互感器是…').startsWith('概念，'), '⑩-2 【概念】→ "概念，"（去符号留停顿）')
ok(cleanSpeechText('电流互感器二次侧严禁{开路}。') === '电流互感器二次侧严禁开路。', '⑩-3 {} 占位只留内容，不会念"大括号"')
/* ⑪ 切块边界保护（用题库真实原文 seq 181 / 1588 / 347 的片段，见 tts-text-audit.mjs 抓的崩点） */
const REAL_181 = 'R =（24 − 1.2 − 0.3）/ 0.006 = 22.5 / 0.006 = 3750Ω，即3.75kΩ；功耗 P = I²R = 0.006² × 3750 = 0.135W。'
const REAL_1588 = '与LOPA（Layer of Protection Analysis）方法是上下游工具，不能颠倒分析时序。'
const REAL_347 = '额定线电流I=P/(√3·U·cosφ·η)=15000/(1.732×380×0.85×0.9)≥29.8A，与C项写法等价。'
const boundaryOK = (chunks) => chunks.every((c, i) => {
  const n = chunks[i + 1]
  if (!n) return true
  if (/[A-Za-z0-9.]$/.test(c) && /^[A-Za-z0-9]/.test(n)) return false          // 词/数字被切断
  if (/[=（(+\-×÷·]$/.test(c)) return false                                    // 末尾悬挂算子或左括号
  if (/^[)）]/.test(n)) return false                                           // 开头孤立右括号
  if ((c.split('（').length - c.split('）').length) !== 0) return false          // 块内括号不配平
  return true
})
ok(boundaryOK(chunkSpeechText(REAL_181, 12)), '⑪-1 真实题 seq181：数字/单位不被切碎（3750Ω 不可切成 "375"+"0Ω"）')
ok(boundaryOK(chunkSpeechText(REAL_1588, 24)), '⑪-2 真实题 seq1588：拉丁词不被切两半（Layer of Protection 保持完整）')
ok(boundaryOK(chunkSpeechText(REAL_347, 18)), '⑪-3 真实题 seq347：括号不跨块、公式不悬挂算子')
ok(chunkSpeechText(REAL_1588, 24).join('') === cleanSpeechText(REAL_1588), '⑪-4 边界保护只移断点、不改内容（拼接恒等）')
/* ⑫ 数学排版符号（真实原文高频：U+2212 减号、上标、下标、等号、间隔号） */
ok(/减/.test(normalizeSpeech('24 − 1.2')) && !/−/.test(normalizeSpeech('24 − 1.2')), '⑫-1 U+2212 减号 → 减（否则引擎可能吞掉）')
ok(normalizeSpeech('I²R') === 'I平方R' && normalizeSpeech('0.006²') === '0.006平方', '⑫-2 上标 ²/³ → 平方/立方（不念"二次方符号"）')
ok(normalizeSpeech('U_F') === 'U F' && normalizeSpeech('U_CE') === 'U CE', '⑫-3 下标写法不再念"下划线"')
ok(/等于/.test(normalizeSpeech('0.006 = 22.5')) , '⑫-4 公式里的 = 读成"等于"')
ok(normalizeSpeech('29.6kV·A') === '29.6千伏安' && normalizeSpeech('10.3kvar') === '10.3千乏', '⑫-5 视在功率/无功单位读法')

console.log(`\ntts.regression：${n} 断言全绿`)
