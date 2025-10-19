import * as Speech from "expo-speech";

export function speakText(text, opts = {}) {
  if (!text) return;
  const { language, rate, pitch, onDone, onError } = opts;
  Speech.speak(text, {
    language, // e.g. "en-US"
    rate, // 0.0 - 1.0 (defaults ~0.75)
    pitch, // 0.0 - 2.0
    onDone,
    onError,
  });
}

export function stopSpeaking() {
  Speech.stop();
}
