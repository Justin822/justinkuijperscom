"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Spraakherkenning van de browser zelf (gratis). Werkt in Chrome, Edge en Safari;
// waar het niet werkt, kun je de dicteerknop van je toetsenbord gebruiken.

export function useSpeech(onText: (text: string, final: boolean) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => {
    const w = window as any;
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const w = window as any;
    const Recognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Recognition) return;
    const rec = new Recognition();
    rec.lang = "nl-NL";
    rec.interimResults = true;
    rec.continuous = true;
    let finalText = "";
    rec.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) finalText += `${r[0].transcript} `;
        else interim += r[0].transcript;
      }
      onTextRef.current((finalText + interim).trim(), false);
    };
    rec.onend = () => {
      setListening(false);
      onTextRef.current(finalText.trim(), true);
    };
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }, []);

  useEffect(() => () => recRef.current?.abort?.(), []);

  return { supported, listening, start, stop };
}
