
import React, { useState } from 'react';
import { Upload, X, Wand2, Loader2, FileVideo, Music, Clock, Mic, Sparkles, Lightbulb, Timer, Repeat, VolumeX, Volume2, MoveHorizontal, Layers, Type, ShoppingCart, Layout, FileText, Copy, Check, Rocket } from 'lucide-react';
import { Gender, VoiceStyle, Tempo, VideoClip, VOConfig, TransitionMode, Platform, SubtitleMode, CategoryType } from '../types';
import { generateScriptSuggestion, generateProductDescription } from '../services/geminiService';

interface ControlPanelProps {
  onClipsChanged: (clips: VideoClip[]) => void;
  onGenerateVO: (config: VOConfig) => Promise<void>;
  isGenerating: boolean;
  clips: VideoClip[];
  videoMuted: boolean;
  onVideoMutedChange: (muted: boolean) => void;
  transitionDuration: number;
  onTransitionDurationChange: (duration: number) => void;
  transitionMode: TransitionMode;
  onTransitionModeChange: (mode: TransitionMode) => void;
  showSubtitles: boolean;
  onShowSubtitlesChange: (show: boolean) => void;
  subtitleMode: SubtitleMode;
  onSubtitleModeChange: (mode: SubtitleMode) => void;
  initialScript: string;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ 
  onClipsChanged, 
  onGenerateVO, 
  isGenerating,
  clips,
  videoMuted,
  onVideoMutedChange,
  transitionDuration,
  onTransitionDurationChange,
  transitionMode,
  onTransitionModeChange,
  showSubtitles,
  onShowSubtitlesChange,
  subtitleMode,
  onSubtitleModeChange,
  initialScript
}) => {
  const [config, setConfig] = useState<VOConfig>({
    gender: Gender.FEMALE,
    style: VoiceStyle.ENTHUSIASTIC,
    tempo: Tempo.NORMAL,
    idea: "",
    targetDuration: 15,
    text: initialScript,
    repeat: false,
    platform: Platform.TIKTOK
  });
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>(CategoryType.FASHION);
  const [isSuggesting, setIsSuggesting] = useState(false);
  
  // Description/Caption State
  const [generatedCaption, setGeneratedCaption] = useState<string>("");
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [captionCopied, setCaptionCopied] = useState(false);

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      video.src = URL.createObjectURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files) as File[];
      const newClipsPromises = files.map(async (file) => {
        const duration = await getVideoDuration(file);
        return {
          id: Math.random().toString(36).substr(2, 9),
          file,
          url: URL.createObjectURL(file),
          duration: duration,
        };
      });
      
      const newClips = await Promise.all(newClipsPromises);
      onClipsChanged([...clips, ...newClips]);
    }
  };

  const removeClip = (id: string) => {
    const updated = clips.filter(c => c.id !== id);
    onClipsChanged(updated);
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
  };
  
  const handleDrop = async (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files) {
        const files = Array.from(e.dataTransfer.files) as File[];
        const videoFiles = files.filter(f => f.type.startsWith('video/'));
        
        const newClipsPromises = videoFiles.map(async (file) => {
            const duration = await getVideoDuration(file);
            return {
                id: Math.random().toString(36).substr(2, 9),
                file,
                url: URL.createObjectURL(file),
                duration: duration,
            };
        });

        const newClips = await Promise.all(newClipsPromises);
        onClipsChanged([...clips, ...newClips]);
      }
  };

  const handleSuggestScript = async () => {
    setIsSuggesting(true);
    try {
        const suggestion = await generateScriptSuggestion(clips, config.idea, config.platform, transitionDuration, selectedCategory);
        if (suggestion) {
            setConfig(prev => ({ ...prev, text: suggestion }));
        }
    } catch (e) {
        console.error("Failed to suggest script", e);
    } finally {
        setIsSuggesting(false);
    }
  };

  const handleGenerateCaption = async () => {
    if (!config.idea) return;
    setIsGeneratingCaption(true);
    try {
        const caption = await generateProductDescription(config.idea, config.platform, selectedCategory);
        setGeneratedCaption(caption);
    } catch (e) {
        console.error("Failed to generate caption", e);
    } finally {
        setIsGeneratingCaption(false);
    }
  };

  const handleCopyCaption = () => {
      navigator.clipboard.writeText(generatedCaption);
      setCaptionCopied(true);
      setTimeout(() => setCaptionCopied(false), 2000);
  };

  return (
    <div className="w-full md:w-96 bg-zinc-900 border-r-0 md:border-r border-zinc-800 h-auto md:h-full overflow-y-auto flex flex-col pb-20 md:pb-0 custom-scrollbar">
      
      <div className="p-6 border-b border-zinc-800">
        <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-2">
           <Wand2 className="text-emerald-400" /> VocalFuse
        </h1>
        <p className="text-zinc-500 text-sm mt-1">AI Video Composer & Narrator</p>
      </div>

      <div className="p-6 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-100 mb-4 flex items-center gap-2">
            <FileVideo size={16} /> Source Clips
        </h2>
        
        <div 
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="border-2 border-dashed border-zinc-700 rounded-xl p-6 flex flex-col items-center justify-center hover:bg-zinc-800/50 hover:border-emerald-500/50 transition-colors cursor-pointer relative"
        >
          <input 
            type="file" 
            multiple 
            accept="video/*" 
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={handleFileChange}
          />
          <Upload className="text-zinc-500 mb-2" />
          <p className="text-xs text-zinc-400 text-center">Tarik video ke sini atau klik</p>
        </div>

        <div className="mt-4 space-y-2">
          {clips.map((clip, idx) => (
            <div key={clip.id} className="flex items-center justify-between bg-zinc-800 p-2 rounded-lg text-xs border border-zinc-700">
              <div className="flex flex-col min-w-0 pr-2">
                <span className="truncate text-zinc-300 font-medium">
                    {idx + 1}. {clip.file.name}
                </span>
                <span className="text-[10px] text-emerald-500 font-mono">
                    Durasi: {clip.duration.toFixed(1)}s
                </span>
              </div>
              <button onClick={() => removeClip(clip.id)} className="text-zinc-500 hover:text-red-400 flex-shrink-0">
                <X size={14} />
              </button>
            </div>
          ))}
          {clips.length === 0 && <p className="text-zinc-600 text-xs italic">Belum ada video.</p>}
        </div>
      </div>

      <div className="p-6 border-b border-zinc-800 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-100 mb-4 flex items-center gap-2">
            <Clock size={16} /> Pengaturan Projek
        </h2>
        
        <div className="space-y-2">
            <label className="text-xs text-zinc-400 flex items-center gap-2">
                <Layers size={14} className="text-emerald-400" />
                Mode Transisi
            </label>
            <div className="grid grid-cols-2 gap-2">
                {Object.values(TransitionMode).map((mode) => (
                    <button
                        key={mode}
                        onClick={() => onTransitionModeChange(mode)}
                        className={`py-2 px-1 rounded-md text-[10px] font-medium transition-all ${
                            transitionMode === mode 
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                            : 'bg-zinc-800 text-zinc-400 border border-transparent hover:bg-zinc-700'
                        }`}
                    >
                        {mode === TransitionMode.FADE_TO_BLACK ? 'Fade Black' : 'Cross Fade'}
                    </button>
                ))}
            </div>
        </div>

        <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
                <label className="text-xs text-zinc-400 flex items-center gap-2">
                    <Type size={14} className={showSubtitles ? "text-blue-400" : "text-zinc-500"} />
                    Subtitle
                </label>
                <button
                    onClick={() => onShowSubtitlesChange(!showSubtitles)}
                    className={`w-10 h-5 rounded-full relative transition-colors ${showSubtitles ? 'bg-blue-500' : 'bg-zinc-700'}`}
                >
                    <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all ${showSubtitles ? 'left-6' : 'left-1'}`} />
                </button>
            </div>

            {showSubtitles && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                     <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold flex items-center gap-1">
                        <Layout size={10} /> Gaya Teks
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.values(SubtitleMode).map((mode) => (
                            <button
                                key={mode}
                                onClick={() => onSubtitleModeChange(mode)}
                                className={`py-1.5 px-1 rounded text-[10px] font-medium transition-all ${
                                    subtitleMode === mode 
                                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' 
                                    : 'bg-zinc-800 text-zinc-400 border border-transparent hover:bg-zinc-700'
                                }`}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>

        <div className="flex items-center justify-between pt-2">
            <label className="text-xs text-zinc-400 flex items-center gap-2">
                {videoMuted ? <VolumeX size={14} className="text-red-400" /> : <Volume2 size={14} className="text-emerald-400" />}
                Mute Video Asli
            </label>
            <button
                onClick={() => onVideoMutedChange(!videoMuted)}
                className={`w-10 h-5 rounded-full relative transition-colors ${videoMuted ? 'bg-red-500' : 'bg-zinc-700'}`}
            >
                <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all ${videoMuted ? 'left-6' : 'left-1'}`} />
            </button>
        </div>
      </div>

      <div className="p-6">
        <h2 className="text-sm font-semibold text-zinc-100 mb-4 flex items-center gap-2">
            <Mic size={16} /> AI Voiceover
        </h2>

        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 p-3 bg-zinc-800/50 rounded-lg border border-zinc-800">
                <div>
                     <label className="text-xs text-zinc-400 block mb-1.5 flex items-center gap-1">
                        <Lightbulb size={12} className="text-yellow-500"/> Produk Anda
                     </label>
                     <input 
                        type="text"
                        value={config.idea}
                        onChange={(e) => setConfig({...config, idea: e.target.value})}
                        placeholder="Contoh: Vacuum cleaner portable..."
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                     />
                </div>

                <div>
                    <label className="text-[10px] text-zinc-500 uppercase font-bold mb-1.5 block">Kategori Script</label>
                    <select 
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value as CategoryType)}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-xs text-zinc-200 focus:outline-none mb-3"
                    >
                        {Object.values(CategoryType).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>

                    <label className="text-xs text-zinc-400 block mb-1.5 flex items-center gap-1">
                        <ShoppingCart size={12} className="text-orange-500"/> Pilih Platform CTA
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                        {Object.values(Platform).map((p) => (
                            <button
                                key={p}
                                onClick={() => setConfig({...config, platform: p})}
                                className={`py-2 px-3 rounded-md text-xs font-medium transition-all text-left flex items-center justify-between ${
                                    config.platform === p 
                                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50' 
                                    : 'bg-zinc-800 text-zinc-400 border border-transparent hover:bg-zinc-700'
                                }`}
                            >
                                {p}
                                {config.platform === p && <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-xs text-zinc-400 block mb-1.5">Persona Suara</label>
                    <div className="grid grid-cols-1 gap-2">
                        {Object.values(Gender).map((g) => (
                            <button
                                key={g}
                                onClick={() => setConfig({...config, gender: g})}
                                className={`py-2 px-3 rounded-md text-xs font-medium transition-all ${
                                    config.gender === g 
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                                    : 'bg-zinc-800 text-zinc-400 border border-transparent hover:bg-zinc-700'
                                }`}
                            >
                                {g}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="text-xs text-zinc-400 block mb-1.5 flex items-center gap-1"><Music size={12}/> Gaya Bicara</label>
                    <select 
                        value={config.style}
                        onChange={(e) => setConfig({...config, style: e.target.value as VoiceStyle})}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                        {Object.values(VoiceStyle).map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="mt-4">
                <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs text-zinc-400">Naskah Script</label>
                    <button 
                        onClick={handleSuggestScript}
                        disabled={isSuggesting || !config.idea}
                        className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 hover:bg-emerald-400/10 px-2 py-1 rounded transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                        {isSuggesting ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                        {isSuggesting ? 'Memproses...' : 'Generate Script'}
                    </button>
                </div>
                <textarea
                    value={config.text}
                    onChange={(e) => setConfig({...config, text: e.target.value})}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 h-48 resize-none font-sans"
                    placeholder="Masukkan script di sini..."
                />
            </div>

            <button
                onClick={() => onGenerateVO(config)}
                disabled={isGenerating || !config.text}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 mt-4"
            >
                {isGenerating ? (
                    <>
                        <Loader2 className="animate-spin" size={18} /> Memproses Suara...
                    </>
                ) : (
                    <>
                        <Wand2 size={18} /> Gabungkan & Render
                    </>
                )}
            </button>
        </div>
      </div>

      <div className="p-6 border-t border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <FileText size={16} className="text-purple-400"/> Deskripsi Produk
              </h2>
              <button
                  onClick={handleGenerateCaption}
                  disabled={isGeneratingCaption || !config.idea}
                  className="text-[10px] bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 px-2 py-1 rounded border border-purple-500/30 flex items-center gap-1 disabled:opacity-50 transition-all"
              >
                  {isGeneratingCaption ? <Loader2 size={10} className="animate-spin"/> : <Sparkles size={10}/>}
                  Buat Caption
              </button>
          </div>

          <div className="relative group">
              <textarea
                  readOnly
                  value={generatedCaption}
                  placeholder="Generate deskripsi di sini..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-xs text-zinc-300 focus:outline-none h-32 resize-none font-sans"
              />
              {generatedCaption && (
                  <button
                      onClick={handleCopyCaption}
                      className="absolute top-2 right-2 p-1.5 bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-300 hover:text-white transition-colors shadow-lg"
                      title="Salin Caption"
                  >
                      {captionCopied ? <Check size={14} className="text-emerald-400"/> : <Copy size={14}/>}
                  </button>
              )}
          </div>
      </div>

      <div className="mt-12 mb-24 px-10 flex flex-col items-center justify-center text-center gap-4 bg-transparent border-t border-zinc-800/20 pt-10 pb-20">
          <div className="p-4 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-2xl border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
              <Rocket className="text-emerald-400 animate-pulse" size={32} />
          </div>
          <div className="space-y-2">
              <h3 className="text-lg font-black text-white uppercase tracking-tighter italic">SEMANGAT AFFILIATE!</h3>
              <p className="text-[11px] text-zinc-500 leading-relaxed max-w-[280px]">
                Keberhasilan affiliate butuh konsistensi. <br/>
                Terus buat konten, satu postingan lagi <br/>
                bisa jadi tiket <span className="text-emerald-400 font-bold border-b border-emerald-400/30">FYP & PECAH TELOR!</span> 🔥
              </p>
          </div>
      </div>
    </div>
  );
};
