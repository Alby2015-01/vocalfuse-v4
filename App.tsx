
import React, { useState } from 'react';
import { VideoClip, VOConfig, TransitionMode, SubtitleMode } from './types';
import { ControlPanel } from './components/ControlPanel';
import { ControlPanelVO } from './components/ControlPanelVO';
import { VideoComposer } from './components/VideoComposer';
import { ImageGenerator } from './components/ImageGenerator';
import { AudioPreview } from './components/AudioPreview';
import { generateVoiceOver } from './services/geminiService';
import { Sparkles, Video, Image as ImageIcon, Mic, AlertCircle } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'image' | 'video' | 'voiceover'>('image');
  
  // Video & Voiceover Shared State
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [audioUrls, setAudioUrls] = useState<string[]>([]);
  const [scriptText, setScriptText] = useState<string>("Pernahkah kamu melihat pemandangan seindah ini?");
  const [isGenerating, setIsGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState<string>("");
  const [loopAudio, setLoopAudio] = useState(false);
  const [videoMuted, setVideoMuted] = useState(true);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [subtitleMode, setSubtitleMode] = useState<SubtitleMode>(SubtitleMode.DYNAMIC);
  const [transitionDuration, setTransitionDuration] = useState(1.0);
  const [transitionMode, setTransitionMode] = useState<TransitionMode>(TransitionMode.FADE_TO_BLACK);

  const handleGenerateVO = async (config: VOConfig) => {
    setIsGenerating(true);
    setGenStatus("Memulai generasi suara...");
    setScriptText(config.text);
    
    try {
      const regex = /\[Klip \d+\]/gi;
      const parts = config.text.split(regex).map(p => p.trim()).filter(p => p.length > 0);
      
      const newUrls: string[] = [];
      
      // Process sequentially to avoid hitting rate limits on free tier
      // Support up to 4 clips based on new script structure
      for (let i = 0; i < Math.min(parts.length, 4); i++) {
        setGenStatus(`Membangun audio klip ${i + 1} dari ${parts.length}...`);
        const partText = parts[i];
        const clipDuration = clips[i]?.duration || 5;
        
        // Pass precise duration constraint to the API
        const availableDuration = Math.max(2, clipDuration - (i < clips.length - 1 ? 0.5 : 0));
        
        const blob = await generateVoiceOver(partText, config.gender, config.style, config.tempo, availableDuration);
        newUrls.push(URL.createObjectURL(blob));
        
        // Extended delay between segments to be safe for free tier
        if (i < parts.length - 1) {
            setGenStatus(`Menunggu antrian API (Cooling down)...`);
            await new Promise(r => setTimeout(r, 3000));
        }
      }
      
      setAudioUrls(newUrls);
      setLoopAudio(config.repeat);
      setGenStatus("Generasi selesai!");
      setTimeout(() => setGenStatus(""), 3000);
    } catch (err: any) {
      console.error(err);
      const isQuota = err?.message?.includes("429");
      const msg = isQuota
        ? "Kuota API habis atau Rate Limit tercapai. Kuota gratis reset pukul 14:00/15:00 WIB. Coba lagi nanti." 
        : "Gagal membuat suara. Pastikan API Key valid.";
      alert(msg);
      setGenStatus("Gagal.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTabChange = (tab: 'image' | 'video' | 'voiceover') => {
    setActiveTab(tab);
    setClips([]);
    setAudioUrls([]);
    setScriptText("");
    setGenStatus("");
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Top Navbar */}
      <nav className="h-auto md:h-16 border-b border-zinc-800 flex flex-col md:flex-row items-center px-4 md:px-6 py-3 md:py-0 justify-between bg-zinc-900/50 backdrop-blur-xl z-50 gap-3 md:gap-0 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Sparkles className="text-white w-5 h-5" />
          </div>
          <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">VocalFuse Affiliate</span>
        </div>
        
        <div className="flex gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 w-full md:w-auto overflow-x-auto">
          <button 
            onClick={() => handleTabChange('image')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'image' ? 'bg-zinc-800 text-emerald-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <ImageIcon size={16} /> Studio
          </button>
          <button 
            onClick={() => handleTabChange('video')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'video' ? 'bg-zinc-800 text-emerald-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Video size={16} /> Fuse
          </button>
          <button 
            onClick={() => handleTabChange('voiceover')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'voiceover' ? 'bg-zinc-800 text-emerald-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Mic size={16} /> Voice
          </button>
        </div>
        
        {genStatus && (
           <div className="flex items-center gap-2 px-4 py-1.5 bg-zinc-800 rounded-full border border-zinc-700 animate-in fade-in slide-in-from-top-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">{genStatus}</span>
           </div>
        )}
        <div className="hidden md:block w-24"></div> 
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'image' ? (
          <ImageGenerator />
        ) : (
          <div className="flex flex-col md:flex-row h-full overflow-y-auto md:overflow-hidden">
            <div className="w-full md:w-auto h-auto md:h-full shrink-0 order-1 md:order-1">
               {activeTab === 'video' ? (
                 <ControlPanel 
                    clips={clips} 
                    onClipsChanged={setClips} 
                    onGenerateVO={handleGenerateVO}
                    isGenerating={isGenerating}
                    videoMuted={videoMuted}
                    onVideoMutedChange={setVideoMuted}
                    transitionDuration={transitionDuration}
                    onTransitionDurationChange={setTransitionDuration}
                    transitionMode={transitionMode}
                    onTransitionModeChange={setTransitionMode}
                    showSubtitles={showSubtitles}
                    onShowSubtitlesChange={setShowSubtitles}
                    subtitleMode={subtitleMode}
                    onSubtitleModeChange={setSubtitleMode}
                    initialScript={scriptText}
                  />
               ) : (
                 <ControlPanelVO 
                    clips={clips} 
                    onClipsChanged={setClips} 
                    onGenerateVO={handleGenerateVO}
                    isGenerating={isGenerating}
                    initialScript={scriptText}
                  />
               )}
            </div>

            <div className="flex-1 h-[60vh] md:h-full shadow-xl md:shadow-none bg-zinc-950 order-2 md:order-2">
               <div className="h-full w-full md:p-6">
                 {activeTab === 'video' ? (
                    <VideoComposer 
                      clips={clips} 
                      audioUrls={audioUrls} 
                      scriptText={scriptText}
                      showSubtitles={showSubtitles}
                      subtitleMode={subtitleMode}
                      transitionDuration={transitionDuration} 
                      transitionMode={transitionMode}
                      loopAudio={loopAudio}
                      videoMuted={videoMuted}
                      isGenerating={isGenerating}
                    />
                 ) : (
                    <AudioPreview 
                      audioUrls={audioUrls} 
                      isGenerating={isGenerating} 
                      onClear={() => setAudioUrls([])}
                    />
                 )}
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
