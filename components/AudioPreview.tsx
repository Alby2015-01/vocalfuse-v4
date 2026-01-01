
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Download, Volume2, Loader2, Mic, Trash2, Rocket } from 'lucide-react';

interface AudioPreviewProps {
  audioUrls: string[];
  isGenerating: boolean;
  onClear?: () => void;
}

export const AudioPreview: React.FC<AudioPreviewProps> = ({ audioUrls, isGenerating, onClear }) => {
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [isPlayingFull, setIsPlayingFull] = useState(false);
  const audioRefs = useRef<(HTMLAudioElement | null)[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const playPromises = useRef<Map<HTMLMediaElement, Promise<void>>>(new Map());

  // Sync refs array size
  useEffect(() => {
    audioRefs.current = audioRefs.current.slice(0, audioUrls.length);
  }, [audioUrls]);

  const safePlay = useCallback((el: HTMLMediaElement) => {
    const p = el.play();
    if (p !== undefined) {
      playPromises.current.set(el, p);
      p.catch(() => {}).finally(() => {
        if (playPromises.current.get(el) === p) playPromises.current.delete(el);
      });
    }
  }, []);

  const safePause = useCallback(async (el: HTMLMediaElement) => {
    const p = playPromises.current.get(el);
    if (p) {
      try { await p; } catch (e) {}
    }
    el.pause();
  }, []);

  const togglePlaySegment = async (idx: number) => {
    const audio = audioRefs.current[idx];
    if (!audio) return;

    if (playingIdx === idx) {
      safePause(audio);
      setPlayingIdx(null);
    } else {
      // Pause others
      for (const a of audioRefs.current) {
        if (a) {
          safePause(a);
          a.currentTime = 0;
        }
      }
      setIsPlayingFull(false);
      safePlay(audio);
      setPlayingIdx(idx);
    }
  };

  const playFullSequence = async () => {
    if (audioUrls.length === 0) return;
    setIsPlayingFull(true);
    setPlayingIdx(null);

    for (let i = 0; i < audioUrls.length; i++) {
        const audio = audioRefs.current[i];
        if (!audio) continue;
        setPlayingIdx(i);
        await new Promise((resolve) => {
            audio.currentTime = 0;
            audio.onended = resolve;
            safePlay(audio);
        });
        if (!isPlayingFull) break; 
    }
    setPlayingIdx(null);
    setIsPlayingFull(false);
  };

  const stopFullSequence = () => {
    setIsPlayingFull(false);
    audioRefs.current.forEach(a => {
        if (a) {
            safePause(a);
            a.currentTime = 0;
        }
    });
    setPlayingIdx(null);
  };

  const downloadCombinedAudio = async () => {
    if (audioUrls.length === 0) return;
    setIsExporting(true);
    try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        
        const buffers = await Promise.all(audioUrls.map(async (url) => {
            const resp = await fetch(url);
            const arrayBuf = await resp.arrayBuffer();
            return await ctx.decodeAudioData(arrayBuf);
        }));

        const totalLength = buffers.reduce((acc, b) => acc + b.length, 0);
        const combined = ctx.createBuffer(1, totalLength, buffers[0].sampleRate);
        const channelData = combined.getChannelData(0);
        
        let offset = 0;
        buffers.forEach(b => {
            channelData.set(b.getChannelData(0), offset);
            offset += b.length;
        });

        const wavBlob = await bufferToWavBlob(combined);
        const downloadUrl = URL.createObjectURL(wavBlob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `VocalFuse-Audio-${Date.now()}.wav`;
        a.click();
        URL.revokeObjectURL(downloadUrl);
    } catch (e) {
        console.error("Download failed", e);
    } finally {
        setIsExporting(false);
    }
  };

  const bufferToWavBlob = (abuffer: AudioBuffer) => {
    const numOfChan = abuffer.numberOfChannels;
    const length = abuffer.length * numOfChan * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let i, sample, offset = 0, pos = 0;

    const setUint16 = (data: number) => { view.setUint16(pos, data, true); pos += 2; };
    const setUint32 = (data: number) => { view.setUint32(pos, data, true); pos += 4; };

    setUint32(0x46464952); 
    setUint32(length - 8);
    setUint32(0x45564157); 
    setUint32(0x20746d66); 
    setUint32(16);
    setUint16(1); 
    setUint16(numOfChan);
    setUint32(abuffer.sampleRate);
    setUint32(abuffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2);
    setUint16(16);
    setUint32(0x61746164); 
    setUint32(length - pos - 4);

    for (i = 0; i < abuffer.numberOfChannels; i++) channels.push(abuffer.getChannelData(i));
    while (pos < length) {
        for (i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
            view.setInt16(pos, sample, true);
            pos += 2;
        }
        offset++;
    }
    return new Blob([buffer], { type: "audio/wav" });
  };

  return (
    <div className="flex flex-col w-full h-full bg-zinc-950 md:rounded-xl overflow-hidden border border-zinc-800 shadow-2xl relative">
      <div className="flex-1 p-8 flex flex-col items-center space-y-8 overflow-y-auto custom-scrollbar">
        {audioUrls.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="text-center space-y-4 max-w-sm animate-in fade-in zoom-in duration-500">
               <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mx-auto border border-zinc-800">
                  <Mic className="w-10 h-10 text-zinc-700" />
               </div>
               <div className="space-y-2">
                  <h3 className="text-lg font-bold text-zinc-200">Audio Preview Belum Siap</h3>
                  <p className="text-sm text-zinc-500">Tulis naskah di panel kiri dan klik "Generate Audio" untuk mendengar suara AI.</p>
               </div>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-3xl space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
            <div className="bg-zinc-900/50 rounded-3xl p-10 border border-zinc-800 flex flex-col items-center gap-6 shadow-inner relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500/0 via-emerald-500/50 to-emerald-500/0"></div>
                <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/20">
                    <Volume2 className="w-12 h-12 text-white" />
                </div>
                <div className="text-center">
                    <h2 className="text-xl font-bold text-white mb-1">Hasil Audio AI</h2>
                    <p className="text-sm text-zinc-500">Terdiri dari {audioUrls.length} segmen suara</p>
                </div>
                <div className="flex gap-4">
                    {!isPlayingFull ? (
                        <button 
                            onClick={playFullSequence}
                            className="bg-white text-black hover:bg-zinc-200 px-8 py-3 rounded-full font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95"
                        >
                            <Play fill="black" size={18} /> Putar Semua
                        </button>
                    ) : (
                        <button 
                            onClick={stopFullSequence}
                            className="bg-red-500 text-white hover:bg-red-600 px-8 py-3 rounded-full font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95"
                        >
                            <Pause fill="white" size={18} /> Berhenti
                        </button>
                    )}
                </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {audioUrls.map((url, idx) => (
                    <div 
                        key={idx} 
                        className={`p-4 rounded-2xl border transition-all flex flex-col gap-3 group ${playingIdx === idx ? 'bg-emerald-500/10 border-emerald-500/40 shadow-lg' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'}`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Klip {idx + 1}</span>
                            {playingIdx === idx && <div className="flex gap-0.5"><div className="w-1 h-3 bg-emerald-500 animate-pulse"></div><div className="w-1 h-2 bg-emerald-400 animate-pulse delay-75"></div><div className="w-1 h-4 bg-emerald-600 animate-pulse delay-150"></div></div>}
                        </div>
                        <button 
                            onClick={() => togglePlaySegment(idx)}
                            className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 font-medium text-xs transition-all ${playingIdx === idx ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-300 group-hover:bg-zinc-700'}`}
                        >
                            {playingIdx === idx ? <Pause size={14} /> : <Play size={14} />}
                            {playingIdx === idx ? 'Playing' : 'Dengar'}
                        </button>
                        <audio ref={el => audioRefs.current[idx] = el} src={url} className="hidden" onEnded={() => setPlayingIdx(null)} />
                    </div>
                ))}
            </div>

            {/* Motivational Text at the bottom of scrollable area */}
            <div className="mt-12 flex flex-col items-center justify-center text-center gap-4 bg-zinc-900/20 p-8 rounded-3xl border border-zinc-800/50">
                <div className="p-3 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                    <Rocket className="text-emerald-400 animate-bounce" size={28} />
                </div>
                <div className="space-y-2">
                    <h3 className="text-base font-black text-white uppercase tracking-wider italic">SEMANGAT NGONTEN!</h3>
                    <p className="text-xs text-zinc-500 leading-relaxed max-w-[280px]">
                      Audio sudah siap, satu langkah lagi menuju konten viral. <br/>
                      Terus konsisten, <span className="text-emerald-400 font-bold">Pecah Telor</span> sudah di depan mata! 🔥
                    </p>
                </div>
            </div>
          </div>
        )}
      </div>

      <div className="h-20 bg-zinc-900 border-t border-zinc-800 flex items-center px-6 justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
             {audioUrls.length > 0 && (
                <button 
                    onClick={onClear}
                    className="p-3 text-zinc-500 hover:text-red-400 transition-colors"
                    title="Hapus Audio"
                >
                    <Trash2 size={20} />
                </button>
             )}
        </div>
        <div className="flex gap-4">
             {isGenerating && (
                 <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium animate-pulse">
                    <Loader2 size={16} className="animate-spin" /> Generating...
                 </div>
             )}
             <button 
                onClick={downloadCombinedAudio}
                disabled={audioUrls.length === 0 || isExporting || isGenerating}
                className="bg-emerald-500 text-white hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-600 px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95 whitespace-nowrap"
             >
                {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                {isExporting ? 'Exporting...' : 'Download WAV'}
             </button>
        </div>
      </div>
    </div>
  );
};
