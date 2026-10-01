/**
 * NAWAT voice layer — إدخال صوتي (تحويل الكلام إلى نص) وردّ صوتي (نطق النص).
 * يعتمد كليًا على واجهات المتصفح المحلية: SpeechRecognition + speechSynthesis.
 */

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type RecognitionCtor = new () => SpeechRecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const VOICE_LANG_KEY = "nawat.voice.lang";
export const VOICE_REPLY_KEY = "nawat.voice.reply";

export function voiceLang(): string {
  if (typeof window === "undefined") return "ar-SA";
  return localStorage.getItem(VOICE_LANG_KEY) ?? "ar-SA";
}

/** إدخال صوتي: يحوّل الكلام إلى نص ويمرّره للمستدعي. */
export function useVoiceInput(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<SpeechRecognitionLike | null>(null);
  const cb = useRef(onText);
  cb.current = onText;

  const [supported, setSupported] = useState(false);
  useEffect(() => { setSupported(recognitionCtor() !== null); }, []);

  const stop = useCallback(() => {
    ref.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setError("التسجيل الصوتي غير مدعوم في هذا المتصفح.");
      return;
    }
    setError(null);
    const rec = new Ctor();
    ref.current = rec;
    rec.lang = voiceLang();
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i]?.[0]?.transcript ?? "";
      }
      if (text.trim()) cb.current(text.trim());
    };
    rec.onerror = (event) => {
      const code = event.error ?? "unknown";
      setError(
        code === "not-allowed"
          ? "تم رفض إذن الميكروفون."
          : `تعذّر التسجيل الصوتي (${code}).`,
      );
      setListening(false);
    };
    rec.onend = () => setListening(false);
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, []);

  useEffect(() => () => ref.current?.abort(), []);

  return { supported, listening, error, start, stop, toggle: () => (listening ? stop() : start()) };
}

/** ردّ صوتي: ينطق نص المساعد عبر مُركِّب الكلام في المتصفح. */
export function useVoiceReply() {
  const [enabled, setEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);
  useEffect(() => { setSupported("speechSynthesis" in window); }, []);

  useEffect(() => {
    try {
      setEnabled(localStorage.getItem(VOICE_REPLY_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(VOICE_REPLY_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      if (!next && typeof window !== "undefined") window.speechSynthesis.cancel();
      return next;
    });
  }, []);

  const stop = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const speak = useCallback(
    (text: string) => {
      if (!supported || !text.trim()) return;
      const clean = text
        .replace(/```[\s\S]*?```/g, " مقطع برمجي ")
        .replace(/[*_#`>|]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 1200);
      if (!clean) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(clean);
      utter.lang = voiceLang();
      utter.rate = 1;
      utter.onend = () => setSpeaking(false);
      utter.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(utter);
    },
    [supported],
  );

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window)
        window.speechSynthesis.cancel();
    };
  }, []);

  return { supported, enabled, speaking, toggle, speak, stop };
}
