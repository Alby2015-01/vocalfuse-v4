
import React, { useState, useEffect } from 'react';
import { Wand2, Loader2, Music, Clock, Mic, Sparkles, Lightbulb, RotateCcw, Rocket, User, Radio, Gauge, FileText } from 'lucide-react';
import { Gender, VoiceStyle, Tempo, VideoClip, VOConfig, Platform, CategoryType } from '../types';
import { generateScriptSuggestion, generateProductDescription } from '../services/geminiService';

interface ControlPanelVOProps {
  onClipsChanged: (clips: VideoClip[]) => void;
  onGenerateVO: (config: VOConfig) => Promise<void>;
  isGenerating: boolean;
  clips: VideoClip[];
  initialScript: string;
}

export const ControlPanelVO: React.FC<ControlPanelVOProps> = ({ 
  onClipsChanged, 
  onGenerateVO, 
  isGenerating,
  clips,
  initialScript
}) => {
  const [config, setConfig] = useState<VOConfig>({
    gender: Gender.FEMALE,
    style: VoiceStyle.ENTHUSIASTIC,
    tempo: Tempo.NORMAL,
    idea: "",
    targetDuration: 20,
    text: initialScript,
    repeat: false,
    platform: Platform.TIKTOK
  });
  
  const [durations, setDurations] = useState<number[]>([5, 5, 5, 5]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>(CategoryType.FASHION);
  const [isSuggesting, setIsSuggesting] = useState(false);

  useEffect(() => {
    const labels = ["Masalah", "Perjuangan", "Penemuan", "Rekomendasi"];
    const newClips: VideoClip[] = durations.map((d, i) => ({
      id: `virtual-${i}`,
      duration: d,
      isVirtual: true,
      label: labels[i]
    }));
    onClipsChanged(newClips);
  }, [durations]);

  const handleDurationChange = (idx: number, val: string) => {
    const num = parseFloat(val) || 1;
    const next = [...durations];
    next[idx] = Math.max(1, Math.min(60, num));
    setDurations(next);
  };

  const handleSuggestScript = async () => {
    setIsSuggesting(true);
    try {
        const suggestion = await generateScriptSuggestion(clips, config.idea, config.platform, 0, selectedCategory);
        if (suggestion) {
            setConfig(prev => ({ ...prev, text: suggestion }));
        }
    } catch (e) {
        console.error("Failed to suggest script", e);
    } finally {
        setIsSuggesting(false);
    }
  };

  return (
    <div className="w-full md:w-96 bg-zinc-900 border-r-0 md:border-r border-zinc-800 h-auto md:h-full overflow-y-auto flex flex-col pb-20 md:pb-0 custom-scrollbar">
      
      <div className="p-6 border-b border-zinc-800">
        <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-2">
           <Mic className="text-emerald-400" /> Audio Studio
        </h1>
        <p className="text-zinc-500 text-sm mt-1">Fasih & Natural AI Voice</p>
      </div>

      <div className="p-6 border-b border-zinc-800">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 mb-4">
            <p className="text-[10px] text-emerald-400 font-medium leading-relaxed">
                <Sparkles size={10} className="inline mr-1" />
                Sekarang AI menggunakan logat Bahasa Indonesia sehari-hari agar konten Anda tidak kaku dan lebih "masuk" ke penonton.
            </p>
        </div>

        <h2 className="text-sm font-semibold text-zinc-100 mb-4 flex items-center gap-2">
            <Clock size={16} /> Durasi Per Segmen
        </h2>
        <div className="space-y-2">
          {["Masalah", "Perjuangan", "Penemuan", "Rekomendasi"].map((label, i) => (
            <div key={label} className="flex items-center justify-between bg-zinc-800/50 p-2.5 rounded-xl border border-zinc-700">
              <span className="text-xs text-zinc-400">{label}</span>
              <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  value={durations[i]} 
                  onChange={(e) => handleDurationChange(i, e.target.value)}
                  className="w-12 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-1 text-xs text-emerald-400 text-center font-mono outline-none"
                />
                <span className="text-[10px] text-zinc-600 font-bold">DETIK</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-6">
        <section className="space-y-4">
            <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Radio size={16} className="text-emerald-400" /> Pengaturan Suara
            </h2>

            <div className="space-y-3">
                <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 flex items-center gap-1">
                        <User size={10} /> Persona & Karakter
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.values(Gender).map((g) => (
                            <button
                                key={g}
                                onClick={() => setConfig({...config, gender: g})}
                                className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${
                                    config.gender === g 
                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                                    : 'bg-zinc-800 text-zinc-400 border-transparent hover:bg-zinc-700'
                                }`}
                            >
                                {g === Gender.MALE ? 'Pria (Deep Voice)' : 'Wanita (Natural)'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 flex items-center gap-1">
                        <Music size={10} /> Gaya & Intonasi
                    </label>
                    <select 
                        value={config.style}
                        onChange={(e) => setConfig({...config, style: e.target.value as VoiceStyle})}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                    >
                        <option value={VoiceStyle.ENTHUSIASTIC}>Energetik & Ceria (Best for Affiliate)</option>
                        <option value={VoiceStyle.NORMAL}>Santai / Sehari-hari</option>
                        <option value={VoiceStyle.PROFESSIONAL}>Serius & Terpercaya</option>
                        <option value={VoiceStyle.CALM}>Lembut / Estetik</option>
                        <option value={VoiceStyle.DRAMATIC}>Menegangkan / Penasaran</option>
                        <option value={VoiceStyle.NEWSCASTER}>Formal ala Berita</option>
                    </select>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 flex items-center gap-1">
                        <Gauge size={10} /> Kecepatan Bicara
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {Object.values(Tempo).map((t) => (
                            <button
                                key={t}
                                onClick={() => setConfig({...config, tempo: t})}
                                className={`py-2 rounded-lg text-[10px] font-bold transition-all border ${
                                    config.tempo === t 
                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' 
                                    : 'bg-zinc-800 text-zinc-400 border-transparent hover:bg-zinc-700'
                                }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </section>

        <section className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <FileText size={16} className="text-emerald-400" /> Naskah Narasi
                </h2>
                <button 
                    onClick={handleSuggestScript}
                    disabled={isSuggesting || !config.idea}
                    className="text-[10px] text-emerald-400 hover:bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 flex items-center gap-1 disabled:opacity-30"
                >
                    <Sparkles size={10} /> Script Gaul AI
                </button>
            </div>

            <textarea
                value={config.text}
                onChange={(e) => setConfig({...config, text: e.target.value})}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 h-40 resize-none outline-none focus:border-emerald-500 font-sans leading-relaxed"
                placeholder="Tulis narasi di sini. AI akan otomatis menyesuaikan intonasi agar fasih dan natural..."
            />

            <button
                onClick={() => onGenerateVO(config)}
                disabled={isGenerating || !config.text}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-700 text-white font-black uppercase tracking-widest py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95"
            >
                {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <RotateCcw size={18} />}
                {isGenerating ? 'Generasi Suara...' : 'Generate Suara Natural'}
            </button>
        </section>
      </div>

      <div className="mt-auto p-8 flex flex-col items-center gap-3 bg-zinc-950/30 border-t border-zinc-800/50">
          <Rocket className="text-emerald-500/50" size={24} />
          <p className="text-[10px] text-zinc-600 uppercase font-black tracking-widest italic text-center leading-relaxed">
            Satu langkah lagi menuju viral.<br/>Terus semangat ngonten affiliate!
          </p>
      </div>
    </div>
  );
};
