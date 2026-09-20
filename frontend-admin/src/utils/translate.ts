// 统一的本地词典翻译逻辑
// 语音识别（话筒）与手动输入（右侧面板）两条入口共用同一份实现，
// 保证同一句话在字幕、翻译历史与会话记录中的译文完全一致。

// 中文 → 英文词典
const ZH_TO_EN: Record<string, string> = {
  '你好': 'Hello',
  '早上好': 'Good morning',
  '晚上好': 'Good evening',
  '晚安': 'Good night',
  '下午好': 'Good afternoon',
  '谢谢': 'Thank you',
  '对不起': 'Sorry',
  '再见': 'Goodbye',
  '是的': 'Yes',
  '不是': 'No',
  '好的': 'OK',
  '请': 'Please',
  '欢迎': 'Welcome',
  '你好吗': 'How are you',
  '我爱你': 'I love you',
};

// 英文 → 中文词典
const EN_TO_ZH: Record<string, string> = {
  'hello': '你好',
  'good morning': '早上好',
  'good evening': '晚上好',
  'good night': '晚安',
  'thank you': '谢谢',
  'thanks': '谢谢',
  'sorry': '对不起',
  'goodbye': '再见',
  'bye': '再见',
  'yes': '是的',
  'no': '不是',
  'ok': '好的',
  'please': '请',
  'welcome': '欢迎',
  'how are you': '你好吗',
  'i love you': '我爱你',
  'good afternoon': '下午好',
};

// 按词长降序返回词条，保证部分替换时长词优先，
// 避免「你好吗」先被「你好」截断而残留多余的字
const entriesByLengthDesc = (dict: Record<string, string>): [string, string][] =>
  Object.entries(dict).sort((a, b) => b[0].length - a[0].length);

// 去除句末标点，便于整句匹配
const stripTrailingPunctuation = (text: string): string =>
  text.trim().replace(/[.!?。！？]+$/, '');

// 是否支持的语言对（目前仅支持中英互译）
export const isSupportedLanguagePair = (sourceLang: string, targetLang: string): boolean =>
  (sourceLang.startsWith('zh') && targetLang.startsWith('en')) ||
  (sourceLang.startsWith('en') && targetLang.startsWith('zh'));

// 统一翻译入口：整句匹配优先，其次部分替换，最后使用统一的兜底写法
export const translateText = (text: string, sourceLang: string, targetLang: string): string => {
  // 英文 → 中文
  if (sourceLang.startsWith('en') && targetLang.startsWith('zh')) {
    const lowerText = stripTrailingPunctuation(text).toLowerCase();

    // 先尝试完整匹配
    if (EN_TO_ZH[lowerText]) {
      return EN_TO_ZH[lowerText];
    }

    // 尝试部分匹配替换（长词优先）
    let result = text;
    entriesByLengthDesc(EN_TO_ZH).forEach(([en, cn]) => {
      result = result.replace(new RegExp(`\\b${en}\\b`, 'gi'), cn);
    });

    // 没有任何匹配时使用兜底写法
    return result !== text ? result : `[待翻译] ${text}`;
  }

  // 中文 → 英文
  if (sourceLang.startsWith('zh') && targetLang.startsWith('en')) {
    const trimmedText = stripTrailingPunctuation(text);

    // 先尝试完整匹配
    if (ZH_TO_EN[trimmedText]) {
      return ZH_TO_EN[trimmedText];
    }

    // 尝试部分匹配替换（长词优先）
    let result = text;
    entriesByLengthDesc(ZH_TO_EN).forEach(([cn, en]) => {
      result = result.replace(new RegExp(cn, 'g'), en);
    });

    // 没有任何匹配时使用兜底写法
    return result !== text ? result : `[Translation] ${text}`;
  }

  return text;
};

// 检测文本是否主要是指定语言
export const isTextInLanguage = (text: string, lang: string): boolean => {
  const trimmedText = text.trim();
  if (!trimmedText) return false;

  // 中文字符正则
  const chineseRegex = /[\u4e00-\u9fa5]/g;
  // 英文字母正则
  const englishRegex = /[a-zA-Z]/g;

  const chineseCount = (trimmedText.match(chineseRegex) || []).length;
  const englishCount = (trimmedText.match(englishRegex) || []).length;

  if (lang.startsWith('zh')) {
    // 源语言是中文：必须包含中文字符
    return chineseCount > 0;
  }

  if (lang.startsWith('en')) {
    // 源语言是英文：不能包含中文字符，且必须有英文字符
    return chineseCount === 0 && englishCount > 0;
  }

  return true;
};
