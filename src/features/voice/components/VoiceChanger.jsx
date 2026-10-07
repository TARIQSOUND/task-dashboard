import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const EFFECTS = [
  { id: 'normal',  label: 'بدون تأثير',  emoji: '🎤', pitch: 1.0,  color: 'bg-neutral-500' },
  { id: 'female',  label: 'صوت أنثى',    emoji: '👩', pitch: 1.4,  color: 'bg-pink-500'    },
  { id: 'male',    label: 'صوت ذكر',     emoji: '👨', pitch: 0.75, color: 'bg-blue-600'    },
  { id: 'deep',    label: 'صوت عميق',    emoji: '🔊', pitch: 0.5,  color: 'bg-indigo-700'  },
  { id: 'chipmunk',label: 'سنجاب',       emoji: '🐿️', pitch: 1.8,  color: 'bg-yellow-500'  },
  { id: 'robot',   label: 'صوت روبوت',   emoji: '🤖', pitch: 1.0,  color: 'bg-green-600'   },
  { id: 'echo',    label: 'صدى الصوت',   emoji: '📢', pitch: 1.0,  color: 'bg-purple-600'  },
  { id: 'alien',   label: 'صوت فضائي',   emoji: '👽', pitch: 1.6,  color: 'bg-teal-500'    },
];

function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function VoiceChanger() {
  const [effect, setEffect] = useState('normal');
  const [volume, setVolume] = useState(1.2);
  const [isLive, setIsLive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordTime, setRecordTime] = useState(0);
  const [status, setStatus] = useState('idle'); // idle | live | recording | done
  const [visualLevel, setVisualLevel] = useState(0);

  const audioCtxRef    = useRef(null);
  const sourceRef      = useRef(null);
  const gainRef        = useRef(null);
  const pitchRef       = useRef(null);
  const delayRef       = useRef(null);
  const feedbackRef    = useRef(null);
  const distortionRef  = useRef(null);
  const ringModRef     = useRef(null);
  const ringOscRef     = useRef(null);
  const analyserRef    = useRef(null);
  const streamRef      = useRef(null);
  const mediaRecRef    = useRef(null);
  const chunksRef      = useRef([]);
  const timerRef       = useRef(null);
  const rafRef         = useRef(null);

  const currentEffect = EFFECTS.find(e => e.id === effect);

  // رسم مستوى الصوت
  const drawLevel = useCallback(() => {
    if (!analyserRef.current) return;
    const buf = new Uint8Array(analyserRef.current.fftSize);
    analyserRef.current.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += Math.abs(buf[i] - 128);
    setVisualLevel(Math.min(100, (sum / buf.length) * 6));
    rafRef.current = requestAnimationFrame(drawLevel);
  }, []);

  const buildGraph = useCallback((ctx, src, vol, eff) => {
    // تنظيف أي عقد سابقة
    [gainRef, pitchRef, delayRef, feedbackRef, distortionRef, ringModRef].forEach(r => {
      try { r.current?.disconnect(); } catch {}
    });
    try { ringOscRef.current?.stop(); } catch {}

    const gainNode = ctx.createGain();
    gainNode.gain.value = vol;
    gainRef.current = gainNode;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    let chain = src;
    chain.connect(analyser);

    if (eff.id === 'robot') {
      const dist = ctx.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = (i * 2) / 256 - 1;
        curve[i] = (Math.PI + 400) * x / (Math.PI + 400 * Math.abs(x));
      }
      dist.curve = curve;
      dist.oversample = '4x';
      distortionRef.current = dist;
      chain.connect(dist);
      dist.connect(gainNode);
    } else if (eff.id === 'echo') {
      const delay = ctx.createDelay(1.0);
      delay.delayTime.value = 0.25;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.45;
      delayRef.current = delay;
      feedbackRef.current = feedback;
      chain.connect(gainNode);
      chain.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      feedback.connect(gainNode);
    } else if (eff.id === 'alien') {
      const ringOsc = ctx.createOscillator();
      ringOsc.frequency.value = 30;
      ringOsc.type = 'sawtooth';
      const ringMod = ctx.createGain();
      ringOsc.connect(ringMod.gain);
      ringOsc.start();
      ringOscRef.current = ringOsc;
      ringModRef.current = ringMod;
      chain.connect(ringMod);
      ringMod.connect(gainNode);
    } else {
      chain.connect(gainNode);
    }

    gainNode.connect(ctx.destination);
  }, []);

  const startLive = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
      audioCtxRef.current = ctx;

      const src = ctx.createMediaStreamSource(stream);
      sourceRef.current = src;

      const eff = EFFECTS.find(e => e.id === effect);
      buildGraph(ctx, src, volume, eff);
      drawLevel();
      setIsLive(true);
      setStatus('live');
    } catch {
      setStatus('idle');
    }
  }, [effect, volume, buildGraph, drawLevel]);

  const stopLive = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    try { audioCtxRef.current?.close(); } catch {}
    streamRef.current?.getTracks().forEach(t => t.stop());
    try { ringOscRef.current?.stop(); } catch {}
    audioCtxRef.current = null;
    streamRef.current = null;
    setIsLive(false);
    setVisualLevel(0);
    if (!isRecording) setStatus('idle');
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    if (!streamRef.current) await startLive();
    const stream = streamRef.current;
    if (!stream) return;

    chunksRef.current = [];
    const rec = new MediaRecorder(stream);
    rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      setRecordedBlob(blob);
      setStatus('done');
    };
    rec.start(100);
    mediaRecRef.current = rec;

    setIsRecording(true);
    setRecordTime(0);
    setStatus('recording');
    timerRef.current = setInterval(() => setRecordTime(t => t + 1), 1000);
  }, [startLive]);

  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current);
    mediaRecRef.current?.stop();
    setIsRecording(false);
  }, []);

  const saveRecording = useCallback(() => {
    if (!recordedBlob) return;
    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voice_${effect}_${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  }, [recordedBlob, effect]);

  const reset = useCallback(() => {
    stopLive();
    stopRecording();
    setRecordedBlob(null);
    setRecordTime(0);
    setStatus('idle');
  }, [stopLive, stopRecording]);

  // إعادة بناء الغراف عند تغيير التأثير أو الصوت أثناء البث
  useEffect(() => {
    if (!isLive || !audioCtxRef.current || !sourceRef.current) return;
    const eff = EFFECTS.find(e => e.id === effect);
    buildGraph(audioCtxRef.current, sourceRef.current, volume, eff);
  }, [effect, volume, isLive, buildGraph]);

  useEffect(() => () => { reset(); }, []);  // تنظيف عند إلغاء التحميل

  const bars = Array.from({ length: 24 }, (_, i) => i);

  return (
    <motion.div
      className="bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl shadow-lg overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* رأس البطاقة */}
      <div className="bg-gradient-to-r from-primary-700 to-secondary-700 px-6 py-4 flex items-center gap-3">
        <span className="text-3xl">🎙️</span>
        <div>
          <h2 className="text-white font-bold text-xl leading-tight">مغيّر الصوت</h2>
          <p className="text-primary-200 text-sm">تأثيرات صوتية مباشرة في المتصفح</p>
        </div>
        <div className="mr-auto flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${isLive ? 'bg-green-400 animate-pulse' : 'bg-neutral-500'}`} />
          <span className="text-white text-sm font-medium">
            {status === 'idle' && 'متوقف'}
            {status === 'live' && 'يعمل'}
            {status === 'recording' && `تسجيل ${formatTime(recordTime)}`}
            {status === 'done' && 'جاهز للحفظ'}
          </span>
        </div>
      </div>

      <div className="p-6 space-y-6" dir="rtl">

        {/* مرئية الصوت */}
        <div className="flex items-end justify-center gap-1 h-16 bg-neutral-900 rounded-xl px-4 py-2">
          {bars.map(i => (
            <motion.div
              key={i}
              className="flex-1 rounded-full bg-primary-400"
              animate={{
                height: isLive
                  ? `${Math.max(4, visualLevel * (0.4 + Math.sin(i * 0.7 + Date.now() / 300) * 0.6))}%`
                  : '4%'
              }}
              transition={{ duration: 0.08 }}
            />
          ))}
        </div>

        {/* اختيار التأثير */}
        <div>
          <p className="text-neutral-300 text-sm font-semibold mb-3">🎚️ اختر التأثير</p>
          <div className="grid grid-cols-4 gap-2">
            {EFFECTS.map(eff => (
              <motion.button
                key={eff.id}
                onClick={() => setEffect(eff.id)}
                whileTap={{ scale: 0.93 }}
                className={`
                  flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all text-xs font-semibold
                  ${effect === eff.id
                    ? 'border-primary-400 bg-primary-900/40 text-primary-300'
                    : 'border-neutral-700 bg-neutral-800 text-neutral-400 hover:border-neutral-500'}
                `}
              >
                <span className="text-2xl">{eff.emoji}</span>
                <span>{eff.label}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* مستوى الصوت */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-neutral-300 text-sm font-semibold">🔊 مستوى الصوت</p>
            <span className="text-primary-400 text-sm font-bold">{volume.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min={0.3} max={2.5} step={0.1}
            value={volume}
            onChange={e => setVolume(parseFloat(e.target.value))}
            className="w-full accent-primary-500 cursor-pointer"
          />
        </div>

        {/* أزرار التحكم */}
        <div className="grid grid-cols-3 gap-3">
          {!isLive ? (
            <motion.button
              onClick={startLive}
              whileTap={{ scale: 0.95 }}
              className="col-span-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-sm transition-colors"
            >
              ▶️ تشغيل
            </motion.button>
          ) : (
            <motion.button
              onClick={stopLive}
              whileTap={{ scale: 0.95 }}
              className="col-span-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors"
            >
              ⏹️ إيقاف
            </motion.button>
          )}

          {!isRecording ? (
            <motion.button
              onClick={startRecording}
              whileTap={{ scale: 0.95 }}
              className="col-span-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm transition-colors"
            >
              ⏺️ تسجيل
            </motion.button>
          ) : (
            <motion.button
              onClick={stopRecording}
              whileTap={{ scale: 0.95 }}
              className="col-span-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-white font-bold text-sm transition-colors animate-pulse"
            >
              ⏸️ إيقاف
            </motion.button>
          )}

          <motion.button
            onClick={recordedBlob ? saveRecording : undefined}
            disabled={!recordedBlob}
            whileTap={recordedBlob ? { scale: 0.95 } : {}}
            className={`col-span-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-colors
              ${recordedBlob
                ? 'bg-green-600 hover:bg-green-500 text-white cursor-pointer'
                : 'bg-neutral-700 text-neutral-500 cursor-not-allowed'}`}
          >
            💾 حفظ
          </motion.button>
        </div>

        {/* معاينة التسجيل */}
        <AnimatePresence>
          {recordedBlob && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-neutral-900 rounded-xl p-3"
            >
              <p className="text-neutral-400 text-xs mb-2">معاينة التسجيل ({formatTime(recordTime)})</p>
              <audio
                controls
                src={URL.createObjectURL(recordedBlob)}
                className="w-full h-8"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* تأثير حالي */}
        <div className="flex items-center gap-3 bg-neutral-900 rounded-xl px-4 py-3">
          <span className="text-2xl">{currentEffect.emoji}</span>
          <div>
            <p className="text-neutral-400 text-xs">التأثير الحالي</p>
            <p className="text-white font-bold">{currentEffect.label}</p>
          </div>
          <div className="mr-auto text-right">
            <p className="text-neutral-400 text-xs">درجة الطبقة</p>
            <p className="text-primary-400 font-bold">{currentEffect.pitch}x</p>
          </div>
        </div>

        <p className="text-neutral-600 text-xs text-center">
          يعمل عبر Web Audio API مباشرة في المتصفح · لا يُرسل أي صوت للخوادم
        </p>
      </div>
    </motion.div>
  );
}
