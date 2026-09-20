// 统一的文本翻译与语言检测逻辑
// 语音识别与手动输入两条入口共用此模块，
// 保证同一原文无论从哪条入口进入都得到同一译文与同一兜底写法

// 检测文本是否主要是指定语言
export const isTextInLanguage = (text: string, lang: string): boolean => {
  const trimmedText = text.trim();
  if (!trimmedText) return false;

  const chineseRegex = /[\u4e00-\u9fa5]/g;
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

// 英文 → 中文词典
const EN_TO_ZH: Record<string, string> = {
  'hello': '你好',
  'good morning': '早上好',
  'good evening': '晚上好',
  'good night': '晚安',
  'good afternoon': '下午好',
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
};

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

// 按短语长度降序做部分替换，避免短词抢先截断长词
// （如“你好”先替换掉“你好吗”的前半段，导致译文残缺并残留“吗”字）
const replaceByDictionary = (
  text: string,
  dict: Record<string, string>,
  useWordBoundary: boolean
): string => {
  let result = text;
  Object.keys(dict)
    .sort((a, b) => b.length - a.length)
    .forEach(key => {
      const pattern = useWordBoundary ? `\\b${key}\\b` : key;
      const flags = useWordBoundary ? 'gi' : 'g';
      result = result.replace(new RegExp(pattern, flags), dict[key]);
    });
  return result;
};

// 统一翻译入口：完整匹配优先，其次部分替换，最后使用统一兜底写法
export const translateText = (
  text: string,
  sourceLang: string,
  targetLang: string
): string => {
  // 英文→中文
  if (sourceLang.startsWith('en') && targetLang.startsWith('zh')) {
    const lowerText = text.toLowerCase().trim().replace(/[.!?。！？]+$/, '');

    // 先尝试完整匹配
    if (EN_TO_ZH[lowerText]) {
      return EN_TO_ZH[lowerText];
    }

    // 尝试部分匹配替换
    const result = replaceByDictionary(text, EN_TO_ZH, true);
    return result !== text ? result : `[待翻译] ${text}`;
  }

  // 中文→英文
  if (sourceLang.startsWith('zh') && targetLang.startsWith('en')) {
    const trimmedText = text.trim().replace(/[.!?。！？]+$/, '');

    // 先尝试完整匹配
    if (ZH_TO_EN[trimmedText]) {
      return ZH_TO_EN[trimmedText];
    }

    // 尝试部分匹配替换
    const result = replaceByDictionary(text, ZH_TO_EN, false);
    return result !== text ? result : `[Translation] ${text}`;
  }

  return text;
};
