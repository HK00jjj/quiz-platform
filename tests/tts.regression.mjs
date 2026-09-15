/* 解析播报 TTS 回归（2026-09-13 增量）
   覆盖 lib/tts.js 的三个纯函数（不触 DOM/浏览器 API，Node 直跑）：
   ① chunkSpeechText：切块上限（中文 50 字/块 ≈ ≤15s 阈值，规避 Chrome 长文 15s 中断 bug）、
      拼回等价（块连起来 = 清洗后原文，一个字不丢）、断点优先级、硬切兜底、空输入
   ② cleanSpeechText：emoji 删除、→ 与换行转停顿、markdown 记号剥离
   ③ pickVoice：选声优先级（晓晓Natural > 云希Natural > Natural > 常见微软本地音 > 任意zh） */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { chunkSpeechText, cleanSpeechText, normalizeSpeech, pickVoice, chunkMaxFor, TTS_RATE, RATE_MIN, RATE_MAX, RATE_STEP, clampRate, fmtRate, ttsRate, sliceForResume, listVoices, voiceQualityOf, voiceAccent, voiceLabel, ttsVoicePref, resolveVoiceByName, zhLike, voiceDiag, cloudTtsUrl, cloudSpd, engineFor, isCloudVoice, isEdgeVoice, EDGE_VOICES, CLOUD_VOICES, CLOUD_CHUNK_MAX, CLOUD_CHUNK_MAX_EDGE, cloudChunkMaxFor, cloudSupported, CLOUD_VOICE_ID, CLOUD_DEFAULT_VOICE, prefetchCloudFirst, gaTrimRange, speakCloudGA, currentPauseTag } from '../src/lib/tts.js'

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
ok(cleanSpeechText('按SB2→KM吸合') === '按SB 2，K M吸合', '②-2 箭头转停顿；SB2/KM 代号逐字母读（2026-09-15 词典新口径）')
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
ok(normalizeSpeech('τ=RC') === '套=R C', '⑨-7 希腊字母按工程口语译名读；RC 代号逐字母（2026-09-15 词典口径）')
ok(normalizeSpeech('AC/DC') === 'A C 或 D C' && normalizeSpeech('I/O') === 'I 或 O', '⑨-8 斜杠组合读成"或"，两端缩写再逐字母（2026-09-15 词典口径）')
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
/* ⑬ 基础单位 V/A/W（2026-09-15 用户实测"220伏读成220v"——单独的拉丁单位字母必须读中文） */
ok(normalizeSpeech('220V') === '220伏' && normalizeSpeech('0.5 V') === '0.5伏', '⑬-1 220V → 220伏（含空格写法）')
ok(normalizeSpeech('0.5A') === '0.5安' && normalizeSpeech('135W') === '135瓦', '⑬-2 A/W 同理（0.5安 / 135瓦）')
ok(normalizeSpeech('12AB') === '12AB', '⑬-3 选项串 "12AB" 不受影响（A 后接字母不映射）')
ok(normalizeSpeech('2A型插座') === '2A型插座', '⑬-4 "A型" 类写法不误伤')
ok(normalizeSpeech('6V6') === '6V 6' && normalizeSpeech('VFD') === 'V F D', '⑬-5 型号"6V6"数字前留空；VFD 已入词典逐字母（2026-09-15 新口径）')
ok(normalizeSpeech('2kWh') === '2千瓦时', '⑫-6 kWh 顺序修正（原 kW 先行会把 kWh 拆成"千瓦h"）')
/* ⑭ 电气自动化读法词典（2026-09-15 用户指令"所有电气自动化相关的都映射上去"；
   词形来源=全库缩写清单 acronym_inventory.txt：PLC 1560 / PE 1288 / NPN 479 …） */
ok(normalizeSpeech('PLC编程').includes('P L C'), '⑭-1 PLC → P L C（全库最高频缩写 1560 处）')
ok(normalizeSpeech('DC24V继电器').includes('D C') && normalizeSpeech('DC24V继电器').includes('24伏'), '⑭-2 DC24V → D C 24伏')
ok(normalizeSpeech('TN-S接地').includes('T N') && !/TN-S/.test(normalizeSpeech('TN-S接地')), '⑭-3 TN-S → T N S（不念"杠"）')
ok(normalizeSpeech('cosφ=0.85').includes('功率因数') && !/cos/i.test(normalizeSpeech('cosφ=0.85')), '⑭-4 cosφ → 功率因数（须在希腊字母替换前）')
ok(normalizeSpeech('IP54').includes('I P') && normalizeSpeech('GB50168').includes('国标'), '⑭-5 IP/GB 标准代号读法')
ok(normalizeSpeech('IGBT模块') === 'I G B T模块', '⑭-6 IGBT 逐字母')
ok(normalizeSpeech('0.5kA') === '0.5千安' && normalizeSpeech('0.6ms') === '0.6毫秒' && normalizeSpeech('5mm') === '5毫米', '⑭-7 补充单位 kA/ms/mm')
ok(normalizeSpeech('1450r/min') === '1450转每分' && normalizeSpeech('45°') === '45度', '⑭-8 r/min 与孤立角度')
ok(normalizeSpeech('AI通道') === 'A I通道' && normalizeSpeech('DI信号') === 'D I信号', '⑭-9 AI/DI 通道代号逐字母')
ok(normalizeSpeech('Modbus协议').includes('Modbus') && normalizeSpeech('ON') === 'ON', '⑭-10 不在表里的词（协议名/ON）保持原样')

/* ── ⑩ 中文音色识别拓宽（2026-09-15 修「手机端 Edge 选不了其他语音」的回归锁）──
   事故背景：安卓系统 TTS 引擎报告的语种标签不保证以 zh 开头（存在 cmn-Hans-CN、空字符串），
   旧口径 /^zh/ 会把这类设备判成「无中文音色」→ 下拉只剩「自动」+ 自动选声回落系统默认。
   本组断言在旧实现下必然失败（cmn/空标签全部落空、listVoices 为空、pickVoice 为 null）。 */
const MV = (name, lang) => ({ name, lang, localService: true })
// ⑩-1 标签口径
ok(zhLike(MV('Microsoft 云健 Online (Natural)', 'cmn-Hans-CN')), '⑩-1 cmn-Hans-CN 视为中文（旧口径漏收）')
ok(!zhLike(MV('系统语音', '')), '⑩-2 空标签且名字无中文特征 → 不收（防把空壳收进来）')
ok(zhLike(MV('中文（中国）', '')), '⑩-3 空标签 + 名含「中文」→ 收录')
ok(!zhLike(MV('Microsoft David', 'en-US')), '⑩-4 en-US 不收')
ok(zhLike(MV('X', 'zh-CN')) && zhLike(MV('X', 'zh_CN')), '⑩-5 zh-CN / zh_CN 两种写法都收')
// ⑩-2 列表：混合清单里，cmn 与空标签中文音都要出现，英文音必须剔除
const MIX = [MV('Microsoft 云健 Online (Natural)', 'cmn-Hans-CN'), MV('中文（中国）', ''), MV('Microsoft David', 'en-US'), MV('Microsoft 慧慧', 'zh-CN')]
const lv = listVoices(MIX)
ok(lv.length === 3, `⑩-6 混合清单收录 3 条中文音（实得 ${lv.length}）`)
ok(lv.some((v) => v.name === 'Microsoft 云健 Online (Natural)'), '⑩-7 cmn 音色出现在下拉里')
ok(lv.every((v) => !/David/.test(v.name)), '⑩-8 英文音色不进中文清单')
// ⑩-3 自动选声：机器只有 cmn 音时不能再返回 null（旧实现必 null → 回落系统机械音）
ok(pickVoice([MV('Microsoft 云健 Online (Natural)', 'cmn-Hans-CN')]) !== null, '⑩-9 仅 cmn 音时自动选声不再落空')
ok(pickVoice([MV('中文（中国）', '')]) !== null, '⑩-10 仅空标签中文音时自动选声不落空')
// ⑩-4 优先级不回退：云健 Natural 仍优先于方言/普通音
ok(/云健/.test(pickVoice([MV('Microsoft 云健 Online (Natural)', 'cmn-Hans-CN'), MV('Microsoft 慧慧', 'zh-CN')]).name), '⑩-11 云健 Natural 优先于本地老音')
ok(/云健/.test(pickVoice([MV('Microsoft 云健 Online (Natural)', 'cmn-Hans-CN'), MV('Microsoft 粤语', 'zh-HK')]).name), '⑩-12 普通话 Natural 优先于粤语')
// ⑩-5 腔调标签：cmn 不该被标成「其它」
ok(voiceAccent(MV('Microsoft 云健 Online (Natural)', 'cmn-Hans-CN')) === '', '⑩-13 cmn-Hans 识别为普通话（无腔调标签）')
// ⑩-6 诊断读数 API 形状（Node 无 window → supported:false，不抛异常）
const dg = voiceDiag()
ok(dg && dg.supported === false && dg.total === 0 && Array.isArray(dg.sample), '⑩-14 voiceDiag 在无 speechSynthesis 环境安全降级')

/* ── ⑪ 云端音色（2026-09-15）──
   两代演进：① 百度女声兜底（fanyi gettts）② 微软神经音两跳代理（与电脑端同音色）。
   本组锁住纯函数：URL 构造（两条线路）/语速映射/块长/引擎决策。 */
// ⑪-1 百度线路：语速 → spd（只落在实测可用的 3 档；0/9/12 实测返回空音频）
ok(cloudSpd(0.5) === 3 && cloudSpd(0.85) === 3, '⑪-1 慢速 → spd=3')
ok(cloudSpd(1) === 5 && cloudSpd(1.15) === 5, '⑪-2 常速 → spd=5')
ok(cloudSpd(1.35) === 7 && cloudSpd(2) === 7, '⑪-3 快速（含默认 1.35）→ spd=7')
ok([3, 5, 7].includes(cloudSpd(0)) && [3, 5, 7].includes(cloudSpd(999)), '⑪-4 越界值也被夹到可用档位')
const uB = cloudTtsUrl('合上断路器 QS#1', 1, CLOUD_VOICE_ID)
ok(/^https:\/\/fanyi\.baidu\.com\/gettts\?/.test(uB), '⑪-5 百度线路 URL 正确')
ok(/[?&]lan=zh(&|$)/.test(uB) && /[?&]source=web(&|$)/.test(uB), '⑪-6 含 lan=zh 与 source=web（缺 source 会返回空）')
ok(/[?&]spd=5(&|$)/.test(uB), '⑪-7 语速参数按 rate 映射')
ok(!/#|\s/.test(uB.split('&text=')[1]), '⑪-8 文本已 URL 编码（# 与空格不裸露）')
ok(decodeURIComponent(uB.split('&text=')[1]) === '合上断路器 QS#1', '⑪-9 编码可无损还原')
// ⑪-2 微软线路（两跳代理）：URL 必须带 voice 且指向 Supabase 端点
const uE = cloudTtsUrl('合上断路器 QS#1', 1.35, 'zh-CN-YunjianNeural')
ok(/^https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/tts\?/.test(uE), '⑪-10 微软线路指向 Supabase 代理端点')
ok(/[?&]voice=zh-CN-YunjianNeural(&|$)/.test(uE), '⑪-11 携带 voice 参数（否则代理会退化成默认音）')
ok(/[?&]rate=1\.35(&|$)/.test(uE), '⑪-12 携带 rate 参数')
ok(decodeURIComponent(uE.split('&text=')[1]) === '合上断路器 QS#1', '⑪-13 微软线路文本编码无损')
ok(cloudTtsUrl('', 1, 'zh-CN-YunjianNeural').endsWith('&text='), '⑪-14 空文本不抛异常')
// ⑪-3 块长上限（URL 安全：百度实测 2000 字会 414）
ok(CLOUD_CHUNK_MAX >= 50 && CLOUD_CHUNK_MAX <= 300, '⑪-15 云端块长在 URL 安全区间')
ok(chunkSpeechText('长'.repeat(400), CLOUD_CHUNK_MAX).every((c) => c.length <= CLOUD_CHUNK_MAX), '⑪-16 云端切块不超上限')
// ⑪-4 音色表与识别
ok(EDGE_VOICES.length >= 5 && EDGE_VOICES[0].id === 'zh-CN-YunjianNeural', '⑪-17 微软音色表首项为云健（与电脑端一致）')
ok(CLOUD_VOICES.some((v) => v.name === CLOUD_VOICE_ID), '⑪-18 云端表含百度备用线路')
ok(isCloudVoice('zh-CN-YunjianNeural') && isCloudVoice(CLOUD_VOICE_ID) && !isCloudVoice('Microsoft Huihui'), '⑪-19 isCloudVoice 只认云端 id')
ok(isEdgeVoice('zh-CN-YunjianNeural') && !isEdgeVoice(CLOUD_VOICE_ID), '⑪-20 isEdgeVoice 区分两条线路')
// ⑪-5 引擎决策：显式选择优先；自动档云端可用一律云端（2026-09-15 下午改：GA 管线零块边界，
// 桌面 native 逐 utterance 网络合成有 0.3~1s 块间隙=句号卡顿主因）
ok(engineFor('sapi', CLOUD_VOICE_ID, true) === 'cloud', '⑪-21 显式选云端 → cloud')
ok(engineFor('natural', 'Microsoft Huihui', true) === 'sys', '⑪-22 显式选系统音 → sys')
ok(engineFor('natural', null, true) === 'cloud', '⑪-23 自动 + 系统是神经音 → cloud（GA 零边界优先，不再省一跳留块间隙）')
ok(engineFor('sapi', null, true) === 'cloud', '⑪-24 自动 + 系统只老式音 → cloud（与电脑端同音色）')
ok(engineFor('network', null, true) === 'cloud', '⑪-25 自动 + 系统是网络音 → cloud')
ok(engineFor(null, null, true) === 'cloud', '⑪-26 自动 + 本机无中文音 → cloud')
ok(engineFor(null, null, false) === 'sys', '⑪-27 云端不可用时回落 sys（不臆造能力）')
ok(cloudSupported() === false, '⑪-28 Node 无 window → cloudSupported() 安全返回 false')

/* ── ⑮ 云端双缓冲与手势预载（2026-09-15，修"读一段停一下 / 点开解析要等一会"）──
   行为设计：播本块时另一 <audio> 预载下一块（云端 24h 缓存必命中），播完切元素零等待；
   「展开参考答案」手势内 prefetchCloudFirst 把蜡封动画 520ms 变成首块加载窗口。
   Node 无 window.Audio → 新 API 必须安全降级（返回 false 不抛）。预载命中/块间零 gap
   的行为验证由线上真机 E2E（CDP 计时）承担，此处锁 Node 形状。 */
ok(prefetchCloudFirst('按SB2→KM吸合') === false, '⑮-1 Node 无 window：手势预载安全返回 false')

/* ── ⑯ 首块小/后续大分块（2026-09-15，修"句号后面顿一下"）──
   微软两跳代理后端实测上限 300 字（probe：450 字 → 400 {"error":"text too long","max":300}）。
   首块保持 150（首响快：合成 RTT 与块长正相关，实测 150 字热合成 ≈2.2s），
   后续块 300（块边界减半 = 句号停顿减半）。 */
const long16 = Array.from({ length: 12 }, (_, i) => `第${i + 1}条要点用于验证分块长度切换，句尾用句号收束。`).join('')
const cs16 = chunkSpeechText(long16, CLOUD_CHUNK_MAX_EDGE, CLOUD_CHUNK_MAX)
ok(cs16.length > 1, '⑯-1 长文按新参数分为多块')
ok(cs16[0].length <= CLOUD_CHUNK_MAX, '⑯-2 首块 ≤150（首响优先）')
ok(cs16.slice(1).every((c) => c.length <= CLOUD_CHUNK_MAX_EDGE), '⑯-3 后续块 ≤300（后端实测上限）')
ok(cs16.join('') === cleanSpeechText(long16), '⑯-4 firstMax 分块拼接恒等（不丢字）')
ok(chunkSpeechText(long16, 200).every((c) => c.length <= 200), '⑯-5 默认参数兼容：单参时 firstMax=max')
ok(cloudChunkMaxFor('zh-CN-YunjianNeural') === CLOUD_CHUNK_MAX_EDGE, '⑯-6 微软两跳线块长 300')
ok(cloudChunkMaxFor(CLOUD_VOICE_ID) === CLOUD_CHUNK_MAX, '⑯-7 百度线块长 150')

/* ── ⑰ 题干自动播报接线锁（2026-09-15，用户钦定"自动读题干，选项不需要读"）──
   stemSpokenOf 与 stem effect 活在 Practice.jsx（React 页面组件，Node 侧无法直接
   import），故按 mastery-gate ⑨ 的接线锁口径锁四件事：占位符防漏答案、effect 挂线、
   「已读」闸分离、入口手势解锁。行为级验证由线上真机 E2E（CDP 捕 utterance）承担。 */
const practiceSrc = readFileSync(new URL('../src/pages/Practice.jsx', import.meta.url), 'utf8')
const learnSrc = readFileSync(new URL('../src/pages/Learn.jsx', import.meta.url), 'utf8')
const ttsSrc = readFileSync(new URL('../src/lib/tts.js', import.meta.url), 'utf8')
const validateSrc = readFileSync(new URL('../src/lib/validate.js', import.meta.url), 'utf8')
ok(/export function stemSpokenOf\(q\) \{/.test(validateSrc) && /import \{ gradeObjective, blanksOf, splitExpected, stemSpokenOf \} from '\.\.\/lib\/validate'/.test(practiceSrc), '⑰-1 stemSpokenOf 纯函数收敛 validate 真源（2026-09-15 晚自 Practice 移入：Learn 入口预载同口径，Practice import 引用）')
ok(/replace\(\/\\\{\[\^\{\}\]\*\\\}\/g, '空'\)/.test(validateSrc), '⑰-2 填空 {…} 占位符读成「空」（占位里可能带着答案，不能外读；真源随 stemSpokenOf 迁至 validate）')
ok(/speak\(stemSpokenOf\(q\), \{ tag: 'stem\|'/.test(practiceSrc), '⑰-3 stem effect 真正调 speak(stemSpokenOf(q), {tag})')
ok(/const stemSpokenRef = useRef\(null\)/.test(practiceSrc), '⑰-4 stemSpokenRef「已读」闸存在（与 spokenKeyRef 分离，防叠音）')
ok(practiceSrc.includes('[ttsOK, index, q?.id, phase, showAnswer, ttsOn]'), '⑰-5 stem effect 依赖数组含 phase/ttsOn（揭晓时不读、开关回开能接住）')
ok(/const nxt = questions\[index \+ 1\][\s\S]{0,80}?if \(nxt\) prefetchGACache\(stemSpokenOf\(nxt\)\)/.test(practiceSrc), '⑰-6 翻题预载已升级（2026-09-15 晚）：GA 缓存线免疫 stopSpeak 清场，flipToNext 挂下一题题干预载——旧禁令"stopSpeak 清场会吃掉预载"只针对 <audio> src 预载，GA 缓存线不受影响（详见 ⑱-24e）')
ok(/import \{[^}]*unlockCloudAudio[^}]*\} from '\.\.\/lib\/tts\.js'/.test(learnSrc), '⑰-7 Learn.jsx 引入 unlockCloudAudio（import 口径放宽：允许并列其他导出）')
ok(/async function run\(mode, opts = \{\}\) \{\s*\n\s*unlockCloudAudio\(\)/.test(learnSrc), '⑰-8 进练习手势内解锁云端 <audio>（移动端首题不被拦）')
ok(/onClick=\{async \(\) => \{\s*\n\s*unlockCloudAudio\(\)\s*\/\/ 重开一轮/.test(practiceSrc), '⑰-9 再练错题手势内解锁云端 <audio>')
ok(/const wasRevealedRef = useRef\(false\)/.test(practiceSrc) && /if \(wasRevealedRef\.current\) \{ stopSpeak\(\); wasRevealedRef\.current = false \}/.test(practiceSrc), '⑰-10 清场双拍守卫：stopSpeak 只在真正离开揭晓态那一拍打（否则第二拍轰掉题干朗读，E2E 实证）')

/* ── ⑱ GA 无缝管线 + 暂停续播上下文对表（2026-09-15 下午，"彻底解决卡顿/停顿"+"关再开从原处续"）──
   GA：fetch 块 MP3 → decodeAudioData → gaTrimRange 裁首尾合成静音 → AudioContext 时间线
   采样级拼接（块间零间隙）。暂停=ctx.suspend()（冻结时间线，采样级位置），续播=resume()。
   Node 无 window：入口必须安全返回 false；纯函数（gaTrimRange）直接回归。 */
ok((() => { const sp = new Float32Array(4000); for (let i = 1000; i < 3000; i++) sp[i] = 0.5 * Math.sin(i * 0.1)
  const r = gaTrimRange(sp); return r.start === 1000 && r.end === 3000 })(), '⑱-1 gaTrimRange 裁掉首尾合成静音（±1000 采样）')
ok((() => { const s = new Float32Array(100); const r = gaTrimRange(s); return r.start === 0 && r.end === 100 })(), '⑱-2 全静音音频不越权裁剪（返回全区间）')
ok((() => { const sp = new Float32Array(100); for (let i = 0; i < 100; i++) sp[i] = 0.5 + 0.2 * Math.sin(i * 0.3)
  const r = gaTrimRange(sp); return r.start === 0 && r.end === 100 })(), '⑱-3 无静音音频不裁剪')
ok(speakCloudGA(['测试文本'], 1, null, undefined, CLOUD_DEFAULT_VOICE, 'reveal|1|x') === false, '⑱-4 Node 无 window：GA 入口安全返回 false')
ok(currentPauseTag() === '', '⑱-5 Node 无会话：currentPauseTag 安全返回空串')
ok(/const webAudioOK = \(\) =>/.test(ttsSrc) && /function gaCtxOf\(\)/.test(ttsSrc) && /export function speakCloudGA\(/.test(ttsSrc), '⑱-6 GA 管线主体存在（webAudioOK/gaCtxOf/speakCloudGA）')
ok(/function stopGASources\(\)/.test(ttsSrc) && /stopGASources\(\)\s+\/\/ GA 会话/.test(ttsSrc), '⑱-7 stopCloud 接管 GA 清场（旧源全停，防叠音）')
ok(/if \(isEdgeVoice\(voice\) && webAudioOK\(\)\) return speakCloudGA/.test(ttsSrc), '⑱-8 线路分派：微软代理线 → GA；百度线（无 CORS）→ 旧 <audio> 管线')
ok(/gaWarm\(cloudTtsUrl\(chunks\[0\], rate, useVoice\)\)/.test(ttsSrc), '⑱-9 prefetchCloudFirst 微软线预热 GA 解码缓存')
ok(/export function currentPauseTag\(\)/.test(ttsSrc), '⑱-10 currentPauseTag 导出（开关续播对表用）')
ok(/\{ rate = ttsRate\(\), onDone, tag \} = \{\}/.test(ttsSrc), '⑱-11 speak() 签名携带 tag')
ok((practiceSrc.match(/tag: 'reveal\|'/g) || []).length >= 4, '⑱-12 Practice 四处解析播报均带 reveal tag（effect/开关/重读/换音色+调速）')
ok(/tag: 'stem\|' \+ index \+ '\|' \+ q\.id/.test(practiceSrc), '⑱-13 题干播报带 stem tag')
ok(/currentPauseTag\(\) === expected && resumeSpeak\(\)/.test(practiceSrc) && /const expected = \(revealed \? 'reveal\|' : 'stem\|'\) \+ index \+ '\|' \+ \(q \? q\.id : ''\)/.test(practiceSrc), '⑱-14 开关续播按上下文对表：tag 匹配才 resume，过期暂停丢弃')
ok(/export function engineFor\(autoQuality, pref, cloudOK\) \{[\s\S]*?return 'cloud'\s*\}/.test(ttsSrc), '⑱-15 engineFor：自动档云端可用一律 cloud（新决策表）')
/* ⑱-16~19 串行排程链闭合锁（2026-09-15 下午事故）：初版只排第一块（排完只"预解码"未递归
   schedule，中间块无 onended）→ 首块以句号收尾播完即永久静音。E2E 当时未覆盖"第二块继续播"
   ——这组锁专堵该盲区：链必须递归闭合、排程本体抽取、全块并行预取、失败跳过也闭合。 */
ok((ttsSrc.match(/schedule\(idx \+ 1\)/g) || []).length >= 3, '⑱-16 排程接力链闭合：schedule(idx+1) 递归出现 ≥3 处（place 失败跳块/正常续链/decode 失败续链）')
ok(/const place = \(idx, buf\) => \{[\s\S]*?src\.start\(t, start \/ sr, dur\)/.test(ttsSrc), '⑱-17 place 排程本体：decode 完成钉上时间线（trim→fade→start(when,offset,dur)）')
ok(/place\(idx, buf\)[\s\S]{0,200}?if \(idx \+ 1 < sess\.urls\.length\) schedule\(idx \+ 1\)/.test(ttsSrc), '⑱-18 then 正常路径续链：place 成功后必须 schedule(idx+1)，绝不断链')
ok(/for \(let k = 1; k < sess\.urls\.length; k\+\+\) gaDecode\(sess\.urls\[k\]\)\.catch\(\(\) => \{\}\)/.test(ttsSrc), '⑱-19 全块并行预取（塞 gaCache，串行链秒取消网络等待；串行排程保顺序）')
/* ⑱-20 响度链（2026-09-15 傍晚"声音太小"）：微软合成 MP3 实测 peak -5~-7.5dBFS / RMS ≈-24dBFS
   偏轻 → 会话级 master 增益 1.6x(+4.1dB) + 限幅器（-1.5dBFS 起压）兜底防削波；块输出接 master。 */
ok(/sess\.master = ctx\.createGain\(\); sess\.master\.gain\.value = 1\.6/.test(ttsSrc) && /sess\.lim = ctx\.createDynamicsCompressor\(\)/.test(ttsSrc) && /g\.connect\(sess\.master\)/.test(ttsSrc) && /sess\.master\.connect\(sess\.lim\); sess\.lim\.connect\(ctx\.destination\)/.test(ttsSrc), '⑱-20 GA 响度链：master 1.6x → 限幅器 → destination（块输出接 master，实测 RMS -24dBFS 补响度）')
ok(/if \(s\.master\) s\.master\.disconnect\(\); if \(s\.lim\) s\.lim\.disconnect\(\)/.test(ttsSrc), '⑱-21 stopGASources 断开响度链（防节点泄漏）')
/* ⑱-22 重读分语境（2026-09-15 傍晚"重读对题干没有效果"）：replayTts 原先未揭晓直接 return
   静默无反应 → 改为答题中重读题干、揭晓后重读解析。 */
ok(!/if \(!revealed\) return/.test(practiceSrc) && (practiceSrc.match(/speak\(stemSpokenOf\(q\), \{ tag: 'stem\|' \+ index \+ '\|' \+ q\.id \}\)/g) || []).length >= 2, '⑱-22 replayTts 分语境：未揭晓守卫已删，题干 speak（effect+重读）≥2 处')
/* ⑱-23 题干声音条（2026-09-15 傍晚）：声音控件原在解析区，答题中无任何重读入口
   ——题干区加精简条（🔊 toggleTts + 🔁 重读题干 replayTts），揭晓后消失由解析区接管。 */
ok(/ttsOK && !answered && !showAnswer && \([\s\S]*?onClick=\{toggleTts\}[\s\S]*?🔁 重读题干[\s\S]*?onClick=\{replayTts\}/.test(practiceSrc), '⑱-23 题干声音条：答题中可见（开关+重读题干），绑定 toggleTts/replayTts')
/* ⑱-24 预载提速（2026-09-15 晚"点解析/翻题就出声"）：解析与题干首块提前预合成进 GA
   缓存（gaCache），开口零网络零解码等待。三层预载接线 + GA-only 守卫（不碰 <audio>
   双缓冲、免疫 stopSpeak 清场——这是解除"翻题不挂预载"旧禁令的前提条件）。 */
const gaPrefBody = ttsSrc.slice(ttsSrc.indexOf('export function prefetchGACache'), ttsSrc.indexOf('export function engineFor'))
ok(/export function prefetchGACache\(raw, rate = ttsRate\(\)\)/.test(ttsSrc) && /if \(!isEdgeVoice\(useVoice\)\) return false/.test(gaPrefBody) && /gaWarm\(cloudTtsUrl\(chunks\[0\], rate, useVoice\)\); return true/.test(gaPrefBody), '⑱-24a prefetchGACache：GA 线专属（isEdgeVoice 守卫 → gaWarm 预热，URL 与 speak 云端分支同参）')
ok(gaPrefBody.length > 0 && gaPrefBody.length < 1200 && !/ensureCloudEls|\.src = url/.test(gaPrefBody), '⑱-24b prefetchGACache 无 <audio> 双缓冲副作用（不与题干朗读抢元素）')
ok(/speak\(stemSpokenOf\(q\), \{ tag: 'stem\|' \+ index \+ '\|' \+ q\.id \}\)\s*\n\s*\/\*[\s\S]{0,500}?prefetchGACache\(spokenOf\(q, null, ord\)\)/.test(practiceSrc), '⑱-24c 题干 effect 预载解析首块（null 版：选择/判断 expected===answer、简答 lastGrade 恒 null）')
ok(/const parts = splitExpected\(q\)[\s\S]{0,80}?if \(parts\.length > 1\) prefetchGACache\(spokenOf\(q, \{ correct: true, expectedParts: parts \}, ord\)\)/.test(practiceSrc), '⑱-24d 填空多空补预载 expectedParts 版（splitExpected 真函数；单空两版 URL 相同 gaWarm 幂等不双请求）')
ok(/const nxt = questions\[index \+ 1\][\s\S]{0,80}?if \(nxt\) prefetchGACache\(stemSpokenOf\(nxt\)\)/.test(practiceSrc), '⑱-24e 翻题手势预载下一题题干首块（360ms 翻牌动画=合成窗口，队列已定 index+1 即下一题）')
ok((practiceSrc.match(/prefetchGACache\(stemSpokenOf\(qs\[0\]\)\)/g) || []).length >= 1 && (learnSrc.match(/prefetchGACache\(stemSpokenOf\(qs\[0\]\)\)/g) || []).length >= 1, '⑱-24f 入口预载首题：Learn run() + 结算页再练错题两处手势（装载时间=合成窗口）')
ok(/export function stemSpokenOf/.test(validateSrc) && /import \{ gradeObjective, blanksOf, splitExpected, stemSpokenOf \} from '\.\.\/lib\/validate'/.test(practiceSrc), '⑱-24g stemSpokenOf/splitExpected 收敛 validate 真源（Practice/Learn 同口径引用防漂移）')

console.log(`\ntts.regression：${n} 断言全绿`)
