
import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { VideoClip, TransitionMode, SubtitleMode } from '../types';

// Standard Lucide icons
import { Play as PlayIcon, Pause as PauseIcon, Download as DownloadIcon, Loader2 as LoaderIcon, Music as MusicIcon, Maximize as MaximizeIcon, Rocket } from 'lucide-react';

interface VideoComposerProps {
  clips: VideoClip[];
  audioUrls: string[];
  scriptText?: string;
  showSubtitles?: boolean;
  subtitleMode?: SubtitleMode;
  transitionDuration?: number; 
  transitionMode?: TransitionMode;
  loopAudio?: boolean;
  videoMuted?: boolean;
  isGenerating?: boolean;
}

// Helper to convert AudioBuffer to WAV Blob
const bufferToWave = (abuffer: AudioBuffer, len: number) => {
  const numOfChan = abuffer.numberOfChannels;
  const length = len * numOfChan * 2 + 44;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  const channels = [];
  let i, sample, offset = 0, pos = 0;

  const setUint16 = (data: number) => { view.setUint16(pos, data, true); pos += 2; };
  const setUint32 = (data: number) => { view.setUint32(pos, data, true); pos += 4; };

  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8);
  setUint32(0x45564157); // "WAVE"
  setUint32(0x20746d66); // "fmt "
  setUint32(16);
  setUint16(1); // PCM
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2);
  setUint16(16);
  setUint32(0x61746164); // "data"
  setUint32(length - pos - 4);

  for (i = 0; i < abuffer.numberOfChannels; i++) channels.push(abuffer.getChannelData(i));
  while (pos < len) {
    for (i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][pos]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      view.setInt16(44 + offset, sample, true);
      offset += 2;
    }
    pos++;
  }
  return new Blob([buffer], { type: "audio/wav" });
};

export const VideoComposer: React.FC<VideoComposerProps> = ({ 
  clips, 
  audioUrls, 
  scriptText = "",
  showSubtitles = false,
  subtitleMode = SubtitleMode.DYNAMIC,
  transitionDuration = 1,
  transitionMode = TransitionMode.CROSS_FADE,
  loopAudio = false,
  videoMuted = true,
  isGenerating = false
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isExportingAudio, setIsExportingAudio] = useState(false);
  const [progress, setProgress] = useState(0); 
  const [loadedCount, setLoadedCount] = useState(0);
  
  const videoRefPrimary = useRef<HTMLVideoElement>(null);
  const videoRefSecondary = useRef<HTMLVideoElement>(null);
  const virtualTimerRef = useRef<{currentTime: number, duration: number}>({currentTime: 0, duration: 5});
  
  const audioRefs = useRef<(HTMLAudioElement | null)[]>([]);
  const gainNodesRef = useRef<(GainNode | null)[]>([]);
  const audioSourcesRef = useRef<(MediaElementAudioSourceNode | null)[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [activePlayer, setActivePlayer] = useState<'primary' | 'secondary'>('primary');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const recordingStoppingRef = useRef(false);

  // Playback promise tracking to prevent AbortError
  const playPromises = useRef<Map<HTMLMediaElement, Promise<void>>>(new Map());

  const safePlay = useCallback((el: HTMLMediaElement | null) => {
    if (!el || !el.src || !el.paused) return;
    const p = el.play();
    if (p !== undefined) {
      playPromises.current.set(el, p);
      p.catch(() => {}).finally(() => {
        if (playPromises.current.get(el) === p) playPromises.current.delete(el);
      });
    }
  }, []);

  const safePause = useCallback(async (el: HTMLMediaElement | null) => {
    if (!el || el.paused) return;
    const p = playPromises.current.get(el);
    if (p) {
      try { await p; } catch (e) {}
    }
    el.pause();
  }, []);

  const totalDuration = useMemo(() => {
    if (clips.length === 0) return 15;
    const videoSum = clips.reduce((acc, clip) => acc + clip.duration, 0);
    const overlaps = (clips.length - 1) * transitionDuration;
    return Math.max(videoSum - overlaps, 1);
  }, [clips, transitionDuration]);

  const parsedSubtitles = useMemo(() => {
    if (!scriptText) return [];
    const regex = /\[Klip \d+\]/gi;
    return scriptText.split(regex).map(p => p.trim()).filter(p => p.length > 0);
  }, [scriptText]);

  const resetPlayer = useCallback(() => {
    setCurrentClipIndex(0);
    setProgress(0);
    setIsPlaying(false);
    setActivePlayer('primary');
    setIsTransitioning(false);
    recordingStoppingRef.current = false;
    virtualTimerRef.current = { currentTime: 0, duration: clips[0]?.duration || 5 };

    if (videoRefPrimary.current) {
        videoRefPrimary.current.src = clips[0]?.url || "";
        videoRefPrimary.current.currentTime = 0;
        if (clips[0]?.url) videoRefPrimary.current.load();
    }
    if (videoRefSecondary.current) {
        videoRefSecondary.current.src = clips[1]?.url || "";
        videoRefSecondary.current.currentTime = 0;
    }
    
    audioRefs.current.forEach((audio, idx) => {
      if (audio) {
        safePause(audio);
        audio.currentTime = 0;
        if (gainNodesRef.current[idx]) gainNodesRef.current[idx]!.gain.setValueAtTime(0, audioCtxRef.current?.currentTime || 0);
      }
    });
  }, [clips, safePause]);

  useEffect(() => { resetPlayer(); }, [clips.length, audioUrls.length, resetPlayer]);

  useEffect(() => {
    audioRefs.current.forEach((audio, idx) => {
        if (audio && idx !== currentClipIndex && !isTransitioning) {
            safePause(audio);
        }
    });
  }, [currentClipIndex, safePause, isTransitioning]);

  useEffect(() => {
      const handleLoad = () => setLoadedCount(c => c + 1);
      const p = videoRefPrimary.current;
      const s = videoRefSecondary.current;
      if (p) p.addEventListener('loadeddata', handleLoad);
      if (s) s.addEventListener('loadeddata', handleLoad);
      return () => {
          if (p) p.removeEventListener('loadeddata', handleLoad);
          if (s) s.removeEventListener('loadeddata', handleLoad);
      };
  }, []);

  useEffect(() => {
    if (audioUrls.length > 0 && !audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioContextClass();
      audioDestRef.current = audioCtxRef.current.createMediaStreamDestination();
    }
  }, [audioUrls]);

  const setupAudioNode = (idx: number) => {
    const audio = audioRefs.current[idx];
    if (audio && audioCtxRef.current && !audioSourcesRef.current[idx]) {
      try {
          const source = audioCtxRef.current.createMediaElementSource(audio);
          const gain = audioCtxRef.current.createGain();
          gain.gain.setValueAtTime(0, audioCtxRef.current.currentTime);
          source.connect(gain);
          gain.connect(audioDestRef.current!);
          gain.connect(audioCtxRef.current.destination);
          audioSourcesRef.current[idx] = source;
          gainNodesRef.current[idx] = gain;
      } catch (e) {
          console.warn("Audio node already connected or failed to connect", e);
      }
    }
  };

  const playWithFade = async (idx: number, fadeDuration: number = 0.6) => {
    const audio = audioRefs.current[idx];
    if (!audio) return;
    setupAudioNode(idx);
    const gainNode = gainNodesRef.current[idx];
    if (audio.paused && audioCtxRef.current) {
      if (gainNode) {
        const now = audioCtxRef.current.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(1.0, now + fadeDuration); 
      }
      safePlay(audio);
    }
  };

  const drawCover = (ctx: CanvasRenderingContext2D, img: HTMLVideoElement | HTMLCanvasElement, targetWidth: number, targetHeight: number, alpha: number = 1) => {
    const imgWidth = (img as HTMLVideoElement).videoWidth || (img as HTMLCanvasElement).width;
    const imgHeight = (img as HTMLVideoElement).videoHeight || (img as HTMLCanvasElement).height;
    if (!imgWidth || !imgHeight) return;

    const imgRatio = imgWidth / imgHeight;
    const targetRatio = targetWidth / targetHeight;

    let drawWidth, drawHeight, drawX, drawY;

    if (imgRatio > targetRatio) {
      drawHeight = targetHeight;
      drawWidth = targetHeight * imgRatio;
      drawX = (targetWidth - drawWidth) / 2;
      drawY = 0;
    } else {
      drawWidth = targetWidth;
      drawHeight = targetWidth / imgRatio;
      drawX = 0;
      drawY = (targetHeight - drawHeight) / 2;
    }

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    ctx.restore();
  };

  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const drawPlaceholder = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, clip: VideoClip, alpha: number = 1) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      const palette = clip.label?.includes("Masalah") ? ["#450a0a", "#111827"] : clip.label?.includes("Solusi") ? ["#064e3b", "#111827"] : ["#1e3a8a", "#111827"];
      gradient.addColorStop(0, palette[0]);
      gradient.addColorStop(1, palette[1]);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.font = `bold ${canvas.width / 4}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText((currentClipIndex + 1).toString(), canvas.width / 2, canvas.height / 2 + 50);
      ctx.fillStyle = "white";
      ctx.font = `bold ${canvas.width / 15}px sans-serif`;
      ctx.fillText(clip.label || "Klip", canvas.width / 2, canvas.height / 2);
      ctx.restore();
    };

    const render = (now: number) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      if (canvas.width !== 1080) { canvas.width = 1080; canvas.height = 1920; }

      const primary = videoRefPrimary.current;
      const secondary = videoRefSecondary.current;
      const activeClip = clips[currentClipIndex];
      const nextClip = clips[currentClipIndex + 1];

      // LOGIKA RENDER
      if (isPlaying || isRecording) {
         let currentTimeInActiveClip = 0;
         if (activeClip?.isVirtual) {
            virtualTimerRef.current.currentTime += delta;
            currentTimeInActiveClip = virtualTimerRef.current.currentTime;
         } else {
            currentTimeInActiveClip = (activePlayer === 'primary' ? primary : secondary)?.currentTime || 0;
         }

         let accumulatedDuration = 0;
         for(let i = 0; i < currentClipIndex; i++) accumulatedDuration += clips[i].duration - transitionDuration;
         const currentGlobalTime = accumulatedDuration + currentTimeInActiveClip;
         
         if (currentGlobalTime <= totalDuration) {
             setProgress((currentGlobalTime / Math.max(totalDuration, 1)) * 100);
         }
         
         const remainingTimeInClip = activeClip.duration - currentTimeInActiveClip;
         
         // Audio Trigger Logic
         if (audioUrls.length >= 1 && currentClipIndex === 0 && audioRefs.current[0]?.paused && audioRefs.current[0]?.currentTime === 0) playWithFade(0, 0.1);
         if (audioUrls.length >= 2 && currentClipIndex === 1 && audioRefs.current[1]?.paused && audioRefs.current[1]?.currentTime === 0) playWithFade(1);
         if (audioUrls.length >= 3 && currentClipIndex === 2 && audioRefs.current[2]?.paused && audioRefs.current[2]?.currentTime === 0) playWithFade(2);
         if (audioUrls.length >= 4 && currentClipIndex === 3 && audioRefs.current[3]?.paused && audioRefs.current[3]?.currentTime === 0) playWithFade(3);

         // Transition Trigger Logic
         if (remainingTimeInClip <= transitionDuration && !isTransitioning && currentClipIndex < clips.length - 1) {
             setIsTransitioning(true);
             const nextPlayer = activePlayer === 'primary' ? secondary : primary;
             if (nextPlayer && nextClip && !nextClip.isVirtual) {
                nextPlayer.src = nextClip.url!;
                nextPlayer.currentTime = 0;
                safePlay(nextPlayer);
             }
         }

         ctx.clearRect(0, 0, canvas.width, canvas.height);

         // --- DRAWING LOGIC ---
         if (isTransitioning) {
             const fadeProgress = 1 - (remainingTimeInClip / transitionDuration);
             const currentPlayer = activePlayer === 'primary' ? primary : secondary;
             const nextPlayer = activePlayer === 'primary' ? secondary : primary;
             const alpha = Math.min(Math.max(fadeProgress, 0), 1);

             if (transitionMode === TransitionMode.FADE_TO_BLACK) {
                 if (fadeProgress < 0.5) {
                    if (activeClip.isVirtual) drawPlaceholder(ctx, canvas, activeClip, 1 - fadeProgress * 2);
                    else if (currentPlayer) drawCover(ctx, currentPlayer, canvas.width, canvas.height, 1 - fadeProgress * 2);
                 } else {
                    if (nextClip.isVirtual) drawPlaceholder(ctx, canvas, nextClip, (fadeProgress - 0.5) * 2);
                    else if (nextPlayer) drawCover(ctx, nextPlayer, canvas.width, canvas.height, (fadeProgress - 0.5) * 2);
                 }
             } else {
                 if (activeClip.isVirtual) drawPlaceholder(ctx, canvas, activeClip, 1);
                 else if (currentPlayer) drawCover(ctx, currentPlayer, canvas.width, canvas.height, 1);
                 
                 if (nextClip.isVirtual) drawPlaceholder(ctx, canvas, nextClip, alpha);
                 else if (nextPlayer) drawCover(ctx, nextPlayer, canvas.width, canvas.height, alpha);
             }

             if (remainingTimeInClip <= 0) {
                 setIsTransitioning(false);
                 setActivePlayer(activePlayer === 'primary' ? 'secondary' : 'primary');
                 setCurrentClipIndex(prev => prev + 1);
                 virtualTimerRef.current.currentTime = 0;
                 if (currentPlayer) safePause(currentPlayer);
             }
         } else {
             const player = activePlayer === 'primary' ? primary : secondary;
             if (activeClip?.isVirtual) drawPlaceholder(ctx, canvas, activeClip);
             else if (player) drawCover(ctx, player, canvas.width, canvas.height);
         }

         // --- SUBTITLES ---
         if (showSubtitles && parsedSubtitles.length > 0) {
            const currentSub = parsedSubtitles[currentClipIndex] || "";
            if (currentSub) {
                const fontSize = canvas.height / 25;
                ctx.font = `italic bold ${fontSize}px sans-serif`;
                ctx.textAlign = 'center';
                const baseY = canvas.height - (canvas.height / 5);
                if (subtitleMode === SubtitleMode.DYNAMIC) {
                    const words = currentSub.split(/\s+/);
                    const wordIndex = Math.min(Math.floor((currentTimeInActiveClip / Math.max(activeClip.duration * 0.8, 0.1)) * words.length), words.length - 1);
                    const wordsPerLine = 3;
                    const lineIdx = Math.floor(wordIndex / wordsPerLine);
                    const startIdx = lineIdx * wordsPerLine;
                    const lineWords = words.slice(startIdx, startIdx + wordsPerLine);
                    let curX = (canvas.width - lineWords.reduce((a, b) => a + ctx.measureText(b).width + (fontSize * 0.3), 0) + (fontSize * 0.3)) / 2;
                    lineWords.forEach((word, idx) => {
                        const isA = (startIdx + idx) === wordIndex;
                        const w = ctx.measureText(word).width;
                        ctx.save();
                        if (isA) { ctx.fillStyle = '#facc15'; ctx.translate(curX + w/2, baseY); ctx.scale(1.2, 1.2); ctx.translate(-(curX + w/2), -baseY); }
                        else { ctx.fillStyle = 'white'; ctx.globalAlpha = 0.6; }
                        ctx.strokeStyle = 'black'; ctx.lineWidth = fontSize / 10;
                        ctx.strokeText(word, curX + w/2, baseY); ctx.fillText(word, curX + w/2, baseY);
                        ctx.restore();
                        curX += w + (fontSize * 0.3);
                    });
                } else {
                    ctx.fillStyle = 'white'; ctx.strokeStyle = 'black'; ctx.lineWidth = fontSize / 10;
                    ctx.strokeText(currentSub, canvas.width / 2, baseY); ctx.fillText(currentSub, canvas.width / 2, baseY);
                }
            }
         }

         if (currentGlobalTime >= totalDuration) {
             if (isRecording) {
                 if (!recordingStoppingRef.current) {
                     recordingStoppingRef.current = true;
                     setTimeout(() => {
                         mediaRecorderRef.current?.stop();
                         setIsPlaying(false);
                         setProgress(100);
                     }, 1200); 
                 }
             } else {
                 setIsPlaying(false); 
                 setProgress(100); 
             }
         }
         animationFrameId = requestAnimationFrame(render);
      } else {
         ctx.clearRect(0, 0, canvas.width, canvas.height);
         const player = activePlayer === 'primary' ? primary : secondary;
         if (activeClip?.isVirtual) drawPlaceholder(ctx, canvas, activeClip);
         else if (player && player.readyState >= 2) drawCover(ctx, player, canvas.width, canvas.height);
         animationFrameId = requestAnimationFrame(render);
      }
    };

    animationFrameId = requestAnimationFrame(render);
    if (isPlaying) {
        if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
        const cur = activePlayer === 'primary' ? videoRefPrimary.current : videoRefSecondary.current;
        if (cur?.paused && cur?.src) safePlay(cur);
    } else if (!isRecording) {
        safePause(videoRefPrimary.current); 
        safePause(videoRefSecondary.current);
        audioRefs.current.forEach(a => { if (a) safePause(a); });
    }
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, isRecording, clips, currentClipIndex, isTransitioning, activePlayer, totalDuration, audioUrls, showSubtitles, subtitleMode, parsedSubtitles, transitionMode, transitionDuration, safePlay, safePause]);

  const togglePlay = () => {
    if (clips.length === 0 || isGenerating || isRecording) return;
    if (!isPlaying && progress >= 100) { resetPlayer(); setTimeout(() => setIsPlaying(true), 150); }
    else setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isRecording || isGenerating) return;
    const val = parseFloat(e.target.value);
    setProgress(val);
    setIsPlaying(false);
    const targetTime = (val / 100) * totalDuration;
    let acc = 0, foundIdx = 0, timeInClip = 0;
    for (let i = 0; i < clips.length; i++) {
        const end = acc + clips[i].duration - (i < clips.length - 1 ? transitionDuration : 0);
        if (targetTime <= end) { foundIdx = i; timeInClip = targetTime - acc; break; }
        acc += clips[i].duration - transitionDuration;
    }
    setCurrentClipIndex(foundIdx); setActivePlayer('primary'); setIsTransitioning(false);
    virtualTimerRef.current.currentTime = timeInClip;
    if (videoRefPrimary.current && clips[foundIdx].url) {
        videoRefPrimary.current.src = clips[foundIdx].url!;
        videoRefPrimary.current.currentTime = Math.min(timeInClip, clips[foundIdx].duration);
    }
    audioRefs.current.forEach((a, idx) => {
        if (!a) return;
        let start = 0;
        if (idx === 1) start = clips[0].duration - transitionDuration;
        else if (idx === 2) start = (clips[0].duration - transitionDuration) + (clips[1].duration - transitionDuration);
        const off = targetTime - start;
        if (off >= 0 && off < a.duration) { a.currentTime = off; if (isPlaying) safePlay(a); } else { safePause(a); a.currentTime = 0; }
    });
  };

  const handleDownloadAudio = async () => {
    if (clips.length === 0 || isRecording || isGenerating || audioUrls.length === 0) return;
    setIsExportingAudio(true);
    try {
        const sampleRate = 44100;
        const offlineCtx = new OfflineAudioContext(2, Math.ceil(totalDuration * sampleRate), sampleRate);
        const buffers = await Promise.all(audioUrls.map(async (url) => {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            return await offlineCtx.decodeAudioData(arrayBuffer);
        }));
        buffers.forEach((buffer, idx) => {
            const source = offlineCtx.createBufferSource();
            source.buffer = buffer;
            const gain = offlineCtx.createGain();
            let startTime = 0;
            if (idx === 1) startTime = clips[0].duration - transitionDuration;
            else if (idx === 2) startTime = (clips[0].duration - transitionDuration) + (clips[1].duration - transitionDuration);
            else if (idx === 3) startTime = (clips[0].duration - transitionDuration) + (clips[1].duration - transitionDuration) + (clips[2].duration - transitionDuration);
            
            let stopTime = startTime + clips[idx].duration;
            const fadeDuration = idx === 0 ? 0.1 : 0.4;
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(1.0, startTime + fadeDuration);
            gain.gain.setValueAtTime(1.0, stopTime - 0.2);
            gain.gain.linearRampToValueAtTime(0, stopTime);

            source.connect(gain);
            gain.connect(offlineCtx.destination);
            source.start(startTime);
            source.stop(stopTime);
        });
        const renderedBuffer = await offlineCtx.startRendering();
        const wavBlob = bufferToWave(renderedBuffer, renderedBuffer.length);
        const url = URL.createObjectURL(wavBlob);
        const a = document.createElement('a'); a.href = url; a.download = `VocalFuse-Audio-${Date.now()}.wav`; a.click();
        URL.revokeObjectURL(url);
    } catch (e) { console.error(e); } finally { setIsExportingAudio(false); }
  };

  const handleDownloadClick = async () => {
      if (clips.length === 0 || isBusy) return;
      if (audioCtxRef.current?.state === 'suspended') await audioCtxRef.current.resume();

      setIsRecording(true); 
      resetPlayer();
      recordingStoppingRef.current = false; 

      await new Promise(r => setTimeout(r, 600)); 
      
      const canvas = canvasRef.current;
      if (!canvas) { setIsRecording(false); return; }
      
      const finalStream = new MediaStream();
      const videoTrack = canvas.captureStream(60).getVideoTracks()[0];
      finalStream.addTrack(videoTrack);
      
      if (audioCtxRef.current && audioDestRef.current) {
         audioRefs.current.forEach((a, i) => { if (a) setupAudioNode(i); });
         const at = audioDestRef.current.stream.getAudioTracks();
         if (at.length > 0) finalStream.addTrack(at[0]);
      }

      try {
        const recorder = new MediaRecorder(finalStream, { 
            mimeType: 'video/webm;codecs=vp9,opus', 
            videoBitsPerSecond: 10000000 
        });
        mediaRecorderRef.current = recorder;
        const chunks: Blob[] = [];
        recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
            a.download = `VocalFuse-${Date.now()}.webm`; a.click();
            setIsRecording(false); 
            setIsPlaying(false);
        };
        recorder.start();
        await new Promise(r => setTimeout(r, 150)); 
        setIsPlaying(true);
      } catch (e) { 
        console.error(e);
        setIsRecording(false); 
      }
  };

  const isBusy = isRecording || isGenerating || isExportingAudio;

  return (
    <div className="flex flex-col w-full h-full bg-zinc-950 md:rounded-xl overflow-hidden shadow-2xl border border-zinc-800 relative group min-h-[400px]">
      <div className="relative flex-grow w-full bg-zinc-900 flex flex-col items-center justify-center overflow-y-auto custom-scrollbar p-6">
        <div className={`relative aspect-[9/16] bg-black shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden flex items-center justify-center transition-opacity duration-700 ${clips.length > 0 || isBusy ? 'opacity-100' : 'opacity-0'} h-[70vh] md:h-[65vh]`}>
            <video ref={videoRefPrimary} className="hidden" playsInline muted={videoMuted} crossOrigin="anonymous" />
            <video ref={videoRefSecondary} className="hidden" playsInline muted={videoMuted} crossOrigin="anonymous" />
            {audioUrls.map((url, idx) => <audio key={url} src={url} ref={el => audioRefs.current[idx] = el} crossOrigin="anonymous" className="hidden" />)}
            
            <canvas ref={canvasRef} className="w-full h-full object-cover" />

            <div className={`absolute inset-0 bg-black/40 ${isBusy ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'} transition-opacity flex items-center justify-center pointer-events-none z-10`}>
                <button onClick={togglePlay} className="w-16 h-16 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center text-white hover:scale-110 transition-transform pointer-events-auto border border-white/20">
                    {isPlaying ? <PauseIcon fill="white" size={24} /> : <PlayIcon fill="white" size={24} className="ml-1" />}
                </button>
            </div>

            {isBusy && (
                <div className="absolute inset-x-4 top-4 bg-emerald-500/90 text-white text-[10px] font-black uppercase tracking-[0.2em] px-4 py-3 rounded-full flex items-center justify-center gap-2 animate-pulse shadow-2xl z-20 pointer-events-none">
                    <LoaderIcon size={12} className="animate-spin" />
                    {isGenerating ? 'AI Voiceover Deep...' : isRecording ? `Rendering... ${Math.min(99, Math.floor(progress))}%` : 'Exporting...'}
                </div>
            )}
        </div>

        {clips.length === 0 && !isBusy && (
          <div className="text-zinc-600 flex flex-col items-center animate-in fade-in zoom-in duration-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <MaximizeIcon className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-xs font-bold uppercase tracking-widest">Siap Generate Video 9:16 Full Screen</p>
          </div>
        )}

        {(clips.length > 0 || isBusy) && (
            <div className="mt-8 mb-4 flex flex-col items-center text-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-700">
                <Rocket className="text-emerald-500/50" size={24} />
                <p className="text-[10px] text-zinc-600 uppercase font-black tracking-widest italic">Semangat Ngonten Affiliate!</p>
            </div>
        )}
      </div>

      <div className="h-20 md:h-16 bg-zinc-900 border-t border-zinc-800 flex items-center px-4 gap-4 shrink-0 z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
        <button onClick={togglePlay} className="text-zinc-100 hover:text-emerald-400 disabled:opacity-30 p-2 transition-colors" disabled={isBusy}>
            {isPlaying ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
        </button>
        <div className="flex-grow flex items-center gap-3">
            <span className="text-[10px] text-zinc-500 font-mono w-10 text-right">0:{(progress * totalDuration / 100).toFixed(0).padStart(2, '0')}</span>
            <input type="range" min="0" max="100" step="0.1" value={progress} onChange={handleSeek} disabled={isBusy} className="flex-grow h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
            <span className="text-[10px] text-zinc-500 font-mono w-10 text-left">0:{totalDuration.toFixed(0).padStart(2, '0')}</span>
        </div>
        
        <div className="flex items-center gap-2">
            <button 
                onClick={handleDownloadAudio}
                disabled={clips.length === 0 || isBusy || audioUrls.length === 0}
                className="flex bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 disabled:opacity-30 px-3 md:px-4 py-2 rounded-xl text-[10px] md:text-xs font-bold items-center gap-2 transition-all border border-zinc-700 whitespace-nowrap"
            >
                {isExportingAudio ? <LoaderIcon size={14} className="animate-spin"/> : <MusicIcon size={14} />}
                <span>{isExportingAudio ? 'MENYIMPAN...' : 'SIMPAN AUDIO'}</span>
            </button>

            <button 
                onClick={handleDownloadClick}
                disabled={clips.length === 0 || isBusy}
                className="bg-emerald-500 text-white hover:bg-emerald-400 disabled:bg-zinc-800 px-4 md:px-6 py-2 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg active:scale-95 whitespace-nowrap"
            >
                {isRecording ? <LoaderIcon size={14} className="animate-spin"/> : <DownloadIcon size={14} />}
                <span className="hidden sm:inline">Simpan Video</span>
                <span className="sm:hidden">Video</span>
            </button>
        </div>
      </div>
    </div>
  );
};
