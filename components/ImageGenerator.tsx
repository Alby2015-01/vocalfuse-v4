
import React, { useState } from 'react';
import { X, Wand2, Loader2, Image as ImageIcon, User, Target, Camera, Video, RefreshCw, Info, PlusCircle, Copy, Check, FileText, Download, Mic, Play, Pause, Sparkles, Tag } from 'lucide-react';
import { ModelType, LocationType, AngleType, PoseType, MarketingImage, CategoryType, Gender, VoiceStyle, Tempo } from '../types';
import { generateMarketingImage, generateVideoPrompt, generateShortVOScript, generateVoiceOver } from '../services/geminiService';

export const ImageGenerator: React.FC = () => {
  const [productName, setProductName] = useState("");
  const [productImg, setProductImg] = useState<string | null>(null);
  const [faceImg, setFaceImg] = useState<string | null>(null);
  const [config, setConfig] = useState({
    category: CategoryType.FASHION,
    model: ModelType.HIJAB,
    location: LocationType.STUDIO_WHITE,
    angle: AngleType.FULL_BODY,
    extra: ""
  });
  const [results, setResults] = useState<MarketingImage[]>([
    { id: '1', label: 'Variasi 1 (Masalah)', url: null, prompt: "" },
    { id: '2', label: 'Variasi 2 (Perjuangan)', url: null, prompt: "" },
    { id: '3', label: 'Variasi 3 (Solusi)', url: null, prompt: "" },
    { id: '4', label: 'Variasi 4 (CTA)', url: null, prompt: "" },
  ]);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [activeGeneratingIdx, setActiveGeneratingIdx] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeAudioIdx, setActiveAudioIdx] = useState<number | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>, setter: (s: string | null) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setter(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const downloadImage = async (dataUrl: string, label: string) => {
    const fileName = `VocalFuse-${label.replace(/\s+/g, '-')}-${Date.now()}.png`;

    const fallbackDownload = () => {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: 'PNG Image',
            accept: { 'image/png': ['.png'] },
          }],
        });

        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const writable = await handle.createWritable();
        await writable.close();
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        fallbackDownload();
      }
    } else {
      fallbackDownload();
    }
  };

  const generateSingle = async (index: number) => {
    setActiveGeneratingIdx(index);
    setResults(prev => {
      const next = [...prev];
      next[index] = { ...next[index], url: null, videoPrompt: null, audioUrl: null, audioScript: null };
      return next;
    });
    
    const poses = [PoseType.STANDING, PoseType.LEANING, PoseType.SITTING, PoseType.INVITING];
    const selectedPose = poses[index] || PoseType.STANDING;

    try {
      const res = await generateMarketingImage(results[index].label, {
        ...config,
        pose: selectedPose,
        productBase64: productImg?.split(',')[1],
        faceBase64: faceImg?.split(',')[1],
        extraPrompt: config.extra
      });
      
      setResults(prev => {
        const next = [...prev];
        next[index] = { ...next[index], url: res.url, prompt: res.prompt };
        return next;
      });
    } catch (e) {
      console.error(e);
      alert("Gagal generate gambar. Pastikan API Key valid.");
    } finally {
      setActiveGeneratingIdx(null);
    }
  };

  const generateAll = async () => {
    if (!productImg) {
      alert("Mohon pilih gambar produk terlebih dahulu.");
      return;
    }
    
    setIsGeneratingAll(true);
    for (let i = 0; i < results.length; i++) {
      await generateSingle(i);
      await new Promise(r => setTimeout(r, 1500)); 
    }
    setIsGeneratingAll(false);
  };

  const createVideoPrompt = async (index: number) => {
    const item = results[index];
    if (!item.url) return;

    setResults(prev => {
      const next = [...prev];
      next[index].isVideoPromptGenerating = true;
      return next;
    });

    try {
      const videoPrompt = await generateVideoPrompt(item.prompt, config.category);
      setResults(prev => {
        const next = [...prev];
        next[index].videoPrompt = videoPrompt;
        next[index].isVideoPromptGenerating = false;
        return next;
      });
    } catch (e) {
      console.error(e);
      setResults(prev => {
        const next = [...prev];
        next[index].isVideoPromptGenerating = false;
        return next;
      });
    }
  };

  const createAudioVO = async (index: number) => {
    const item = results[index];
    if (!item.url) return;

    setResults(prev => {
      const next = [...prev];
      next[index].isAudioGenerating = true;
      return next;
    });

    try {
      const roles = ["Masalah", "Perjuangan", "Penemuan Solusi", "Rekomendasi"];
      const script = await generateShortVOScript(item.prompt, roles[index], productName);
      
      let gender = Gender.FEMALE;
      if (config.model === ModelType.MALE) {
        gender = Gender.MALE;
      }
      
      const audioBlob = await generateVoiceOver(script, gender, VoiceStyle.ENTHUSIASTIC, Tempo.NORMAL, 5);
      const audioUrl = URL.createObjectURL(audioBlob);

      setResults(prev => {
        const next = [...prev];
        next[index].audioUrl = audioUrl;
        next[index].audioScript = script;
        next[index].isAudioGenerating = false;
        return next;
      });
    } catch (e) {
      console.error(e);
      setResults(prev => {
        const next = [...prev];
        next[index].isAudioGenerating = false;
        return next;
      });
    }
  };

  const downloadAudio = (url: string, label: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `VocalFuse-VO-${label.replace(/\s+/g, '-')}-${Date.now()}.wav`;
    a.click();
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col md:flex-row h-full md:overflow-hidden overflow-y-auto bg-zinc-950">
      <aside className="w-full md:w-80 bg-zinc-900 border-b md:border-b-0 md:border-r border-zinc-800 p-6 space-y-6 shrink-0 h-auto md:h-full md:overflow-y-auto custom-scrollbar">
        <section className="space-y-4">
          <h2 className="text-sm font-bold flex items-center gap-2 text-zinc-100">
            <Tag size={16} className="text-emerald-400"/> Identitas Produk
          </h2>
          <div>
            <label className="text-[10px] text-zinc-500 uppercase font-black mb-1.5 block tracking-widest">Nama Produk (Untuk Voiceover)</label>
            <input 
              type="text" 
              value={productName} 
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Contoh: Hijab Silk Premium..." 
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500 text-zinc-200"
            />
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold flex items-center gap-2 text-zinc-100">
              <ImageIcon size={16} className="text-emerald-400"/> Input Konsistensi
            </h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-1 gap-4">
            <div className="space-y-2">
                <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest flex items-center gap-1">
                  <PlusCircle size={10} className="text-emerald-500" /> Referensi Produk
                </label>
                <div className={`relative h-24 md:h-32 bg-zinc-950 border-2 border-dashed rounded-xl flex items-center justify-center overflow-hidden transition-all ${productImg ? 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'border-zinc-800 hover:border-emerald-500/30'}`}>
                {productImg ? (
                    <>
                    <img src={productImg} className="w-full h-full object-contain p-2 bg-black/20" />
                    <button onClick={() => setProductImg(null)} className="absolute top-2 right-2 p-1 bg-red-500/80 rounded-full text-white shadow-lg"><X size={14}/></button>
                    </>
                ) : (
                    <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center gap-2 group">
                    <Camera size={24} className="text-zinc-500 group-hover:text-emerald-400 transition-colors" />
                    <span className="text-[10px] text-zinc-400 text-center font-medium">Pilih Foto Produk</span>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFile(e, setProductImg)}/>
                    </label>
                )}
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-[10px] text-zinc-500 uppercase font-black tracking-widest flex items-center gap-1">
                  <User size={10} className="text-cyan-500" /> Referensi Wajah
                </label>
                <div className={`relative h-24 md:h-32 bg-zinc-950 border-2 border-dashed rounded-xl flex items-center justify-center overflow-hidden transition-all ${faceImg ? 'border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.1)]' : 'border-zinc-800 hover:border-cyan-500/30'}`}>
                {faceImg ? (
                    <>
                    <img src={faceImg} className="w-full h-full object-contain p-2 bg-black/20" />
                    <button onClick={() => setFaceImg(null)} className="absolute top-2 right-2 p-1 bg-red-500/80 rounded-full text-white shadow-lg"><X size={14}/></button>
                    </>
                ) : (
                    <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center gap-2 group">
                    <User size={24} className="text-zinc-500 group-hover:text-cyan-400 transition-colors" />
                    <span className="text-[10px] text-zinc-400 text-center font-medium">Pilih Foto Wajah</span>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFile(e, setFaceImg)}/>
                    </label>
                )}
                </div>
            </div>
          </div>
        </section>

        <section className="space-y-4 pt-2">
          <h2 className="text-sm font-bold flex items-center gap-2 text-zinc-100"><Target size={16} className="text-emerald-400"/> Konfigurasi</h2>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-zinc-500 uppercase font-black mb-1 block">Style</label>
              <select value={config.category} onChange={(e) => setConfig({...config, category: e.target.value as CategoryType})} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500 text-zinc-200">
                {Object.values(CategoryType).map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-[10px] text-zinc-500 uppercase font-black mb-1 block">Model</label>
                    <select value={config.model} onChange={(e) => setConfig({...config, model: e.target.value as ModelType})} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs outline-none text-zinc-200">
                        {Object.values(ModelType).map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] text-zinc-500 uppercase font-black mb-1 block">Lokasi</label>
                    <select value={config.location} onChange={(e) => setConfig({...config, location: e.target.value as LocationType})} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs outline-none text-zinc-200">
                        {Object.values(LocationType).map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                </div>
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 uppercase font-black mb-1 block">Deskripsi Tambahan</label>
              <textarea value={config.extra} onChange={(e) => setConfig({...config, extra: e.target.value})} placeholder="Pegang produk dengan ceria..." className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs h-20 resize-none outline-none text-zinc-200" />
            </div>
            <div className="bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">
              <p className="text-[9px] text-emerald-400 leading-relaxed font-medium">
                <Sparkles size={10} className="inline mr-1" /> Narasi AI otomatis menyebutkan nama produk jika diisi di atas.
              </p>
            </div>
          </div>
        </section>

        <button 
          onClick={generateAll}
          disabled={isGeneratingAll || activeGeneratingIdx !== null || !productImg}
          className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
        >
          {isGeneratingAll ? <Loader2 className="animate-spin" size={18}/> : <Wand2 size={18}/>}
          {isGeneratingAll ? 'Generating...' : 'Generate 4 Variasi'}
        </button>
      </aside>

      <div className="flex-1 bg-zinc-950 p-4 md:p-8 md:overflow-y-auto md:h-full custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-[1400px] mx-auto pb-24 md:pb-12">
          {results.map((item, idx) => (
            <div key={item.id} className="flex flex-col gap-4">
              <div className="flex items-center justify-between px-1">
                <span className={`text-[10px] font-black uppercase tracking-widest ${idx === 0 ? 'text-emerald-400' : idx === 1 ? 'text-cyan-400' : idx === 2 ? 'text-purple-400' : 'text-orange-400'}`}>
                  {item.label}
                </span>
                <div className={`h-2 w-2 rounded-full ${activeGeneratingIdx === idx ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-800'}`}></div>
              </div>

              <div className="aspect-[9/16] bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden relative group shadow-2xl">
                {item.url ? (
                  <>
                    <img src={item.url} className="w-full h-full object-cover" />
                    
                    <div className="absolute top-3 left-3 flex flex-col gap-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => generateSingle(idx)} className="p-2.5 bg-black/60 backdrop-blur-md rounded-xl text-white hover:bg-emerald-500 transition-all border border-white/10" disabled={isGeneratingAll}>
                        <RefreshCw size={16} className={activeGeneratingIdx === idx ? 'animate-spin' : ''}/>
                      </button>
                      <button onClick={() => createVideoPrompt(idx)} disabled={item.isVideoPromptGenerating} title="Buat Prompt Video" className="p-2.5 bg-black/60 backdrop-blur-md rounded-xl text-white hover:bg-blue-500 transition-all border border-white/10">
                        {item.isVideoPromptGenerating ? <Loader2 size={16} className="animate-spin" /> : <Video size={16}/>}
                      </button>
                      <button onClick={() => createAudioVO(idx)} disabled={item.isAudioGenerating} title="Buat Voice Over AI" className="p-2.5 bg-black/60 backdrop-blur-md rounded-xl text-white hover:bg-pink-500 transition-all border border-white/10">
                        {item.isAudioGenerating ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16}/>}
                      </button>
                      <button onClick={() => downloadImage(item.url!, item.label)} title="Download Gambar" className="p-2.5 bg-black/60 backdrop-blur-md rounded-xl text-white hover:bg-zinc-700 transition-all border border-white/10">
                        <Download size={16}/>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-zinc-700 bg-zinc-900/50">
                    {activeGeneratingIdx === idx ? <Loader2 className="animate-spin text-emerald-500" size={32}/> : <ImageIcon size={48} className="opacity-10" />}
                  </div>
                )}
              </div>

              {item.videoPrompt && (
                <div className="bg-zinc-900/80 border border-emerald-500/20 rounded-2xl p-3 flex flex-col gap-2 shadow-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1"><Video size={10} /> Video Prompt</span>
                    <button onClick={() => copyToClipboard(item.videoPrompt!, item.id)} className="p-1 text-zinc-400 hover:text-emerald-400">
                      {copiedId === item.id ? <Check size={10} /> : <Copy size={10} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-300 leading-relaxed italic line-clamp-2">"{item.videoPrompt}"</p>
                </div>
              )}

              {item.audioUrl && (
                <div className="bg-zinc-900/80 border border-pink-500/20 rounded-2xl p-3 flex flex-col gap-2 shadow-xl">
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-pink-400 uppercase tracking-widest flex items-center gap-1"><Mic size={10} /> Voice Over AI</span>
                        <div className="flex gap-2">
                            <button onClick={() => downloadAudio(item.audioUrl!, item.label)} className="p-1 text-zinc-400 hover:text-pink-400"><Download size={10} /></button>
                            <button onClick={() => {
                                    if (activeAudioIdx === idx) setActiveAudioIdx(null);
                                    else {
                                        setActiveAudioIdx(idx);
                                        const aud = document.getElementById(`audio-play-${idx}`) as HTMLAudioElement;
                                        aud?.play();
                                    }
                                }} className="p-1 text-zinc-400 hover:text-emerald-400">
                                {activeAudioIdx === idx ? <Pause size={10} /> : <Play size={10} />}
                            </button>
                        </div>
                    </div>
                    <p className="text-[10px] text-zinc-300 leading-relaxed italic line-clamp-2">"{item.audioScript}"</p>
                    <audio id={`audio-play-${idx}`} src={item.audioUrl} className="hidden" onEnded={() => setActiveAudioIdx(null)} onPause={() => setActiveAudioIdx(null)} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
