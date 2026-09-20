import { useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { translateText, isTextInLanguage } from '@/utils/translate';

// TTS 播报函数
const speakText = (text: string, lang: string) => {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return;
  }
  
  const settings = useAppStore.getState().audioSettings;
  if (!settings.ttsEnabled) {
    return;
  }
  
  // 取消之前的播报
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  
  // 获取合适的语音
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find(v => v.lang.startsWith(lang.split('-')[0])) || voices[0];
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  }
  
  utterance.volume = settings.volume / 100;
  utterance.rate = settings.speed;
  
  console.log('[TTS] 即时播报:', text);
  window.speechSynthesis.speak(utterance);
};

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onaudiostart: (() => void) | null;
  onsoundstart: (() => void) | null;
  onnomatch: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export const useSpeechRecognition = () => {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldRestartRef = useRef(false);
  const speechDetectedRef = useRef(false);
  const resultReceivedRef = useRef(false);
  
  const isMicOn = useAppStore(state => state.isMicOn);
  const sourceLang = useAppStore(state => state.sourceLang);
  const targetLang = useAppStore(state => state.targetLang);

  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognitionAPI) {
      if (isMicOn) {
        useAppStore.getState().addToast('error', '浏览器不支持语音识别');
      }
      return;
    }

    if (isMicOn) {
      console.log('[语音识别] 🎯 初始化...');
      
      const recognition = new SpeechRecognitionAPI();
      recognitionRef.current = recognition;
      shouldRestartRef.current = true;
      speechDetectedRef.current = false;
      resultReceivedRef.current = false;

      // 关键配置
      recognition.continuous = false;  // 改为 false，每次说完一句就停止
      recognition.interimResults = true;
      recognition.lang = sourceLang;
      recognition.maxAlternatives = 1;

      console.log('[语音识别] 配置:', { lang: sourceLang, continuous: false, interimResults: true });

      recognition.onstart = () => {
        console.log('[语音识别] ✅ 已启动');
        useAppStore.getState().addToast('success', '请说话...');
      };

      recognition.onaudiostart = () => {
        console.log('[语音识别] 🎤 音频开始');
      };

      recognition.onsoundstart = () => {
        console.log('[语音识别] 🔊 检测到声音');
      };

      recognition.onspeechstart = () => {
        console.log('[语音识别] 🗣️ 检测到语音');
        speechDetectedRef.current = true;
      };

      recognition.onspeechend = () => {
        console.log('[语音识别] 🗣️ 语音结束');
      };

      recognition.onnomatch = () => {
        console.log('[语音识别] ❓ 无法识别');
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        resultReceivedRef.current = true;
        console.log('[语音识别] 📝 ===== 收到结果 =====');
        
        const store = useAppStore.getState();
        const currentSourceLang = store.sourceLang;
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0].transcript;
          console.log(`[语音识别] [${i}] "${text}" isFinal=${result.isFinal}`);
          
          if (result.isFinal) {
            final += text;
          } else {
            interim += text;
          }
        }

        if (interim) {
          console.log('[语音识别] 临时:', interim);
          store.setCurrentSubtitle(interim);
        }

        if (final.trim()) {
          // 检查识别结果是否符合源语言
          if (!isTextInLanguage(final, currentSourceLang)) {
            console.log('[语音识别] ⚠️ 语言不匹配，已忽略:', final);
            console.log('[语音识别] 期望语言:', currentSourceLang);
            store.setCurrentSubtitle('');
            store.addToast('warning', '请使用设置的源语言说话');
            return;
          }
          
          console.log('[语音识别] ✅ 最终:', final);
          store.setCurrentSubtitle('');
          const translated = translateText(final, currentSourceLang, store.targetLang);
          store.addSubtitle(final, translated);
          
          // 立即播报翻译结果
          speakText(translated, store.targetLang);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('[语音识别] ❌ 错误:', event.error);
        
        if (event.error === 'not-allowed') {
          useAppStore.getState().addToast('error', '请允许麦克风权限');
          shouldRestartRef.current = false;
        } else if (event.error === 'no-speech') {
          console.log('[语音识别] 未检测到语音');
        } else if (event.error === 'network') {
          console.log('[语音识别] ⚠️ 网络错误');
          useAppStore.getState().addToast('warning', '需要网络连接');
        }
      };

      recognition.onend = () => {
        console.log('[语音识别] 🔚 结束');
        console.log('[语音识别] speechDetected:', speechDetectedRef.current);
        console.log('[语音识别] resultReceived:', resultReceivedRef.current);
        
        // 如果检测到语音但没有结果，说明可能是网络问题
        if (speechDetectedRef.current && !resultReceivedRef.current) {
          console.log('[语音识别] ⚠️ 检测到语音但无结果，可能是网络问题');
          useAppStore.getState().addToast('warning', '语音已检测但无法识别，请检查网络');
        }
        
        // 重置状态
        speechDetectedRef.current = false;
        resultReceivedRef.current = false;
        
        // 自动重启
        if (shouldRestartRef.current && useAppStore.getState().isMicOn) {
          setTimeout(() => {
            if (shouldRestartRef.current && recognitionRef.current) {
              try {
                console.log('[语音识别] 🔄 重启...');
                recognitionRef.current.start();
              } catch (e) {
                console.error('[语音识别] 重启失败:', e);
              }
            }
          }, 500);
        }
      };

      try {
        recognition.start();
        console.log('[语音识别] 🚀 启动成功');
      } catch (e) {
        console.error('[语音识别] 启动失败:', e);
      }

    } else {
      console.log('[语音识别] 🛑 停止');
      shouldRestartRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
      useAppStore.getState().setCurrentSubtitle('');
    }

    return () => {
      shouldRestartRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, [isMicOn, sourceLang, targetLang]);

  return {
    isSupported: typeof window !== 'undefined' && 
      (!!window.SpeechRecognition || !!window.webkitSpeechRecognition),
  };
};
