
import { GoogleGenAI, Modality } from "@google/genai";
import { Gender, VoiceStyle, Tempo, VideoClip, Platform, ModelType, LocationType, AngleType, PoseType, CategoryType } from '../types';

// Utility for exponential backoff retries
const fetchWithRetry = async <T>(fn: () => Promise<T>, retries = 5, delay = 6000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const errorMsg = error?.message || "";
    const isQuotaError = errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED");
    
    if (isQuotaError && retries > 0) {
      console.warn(`Gemini API Quota hit. Menunggu ${delay/1000} detik sebelum mencoba lagi... (${retries} sisa percobaan)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(fn, retries - 1, delay * 1.5);
    }
    
    throw error;
  }
};

/**
 * Creates a fresh instance of GoogleGenAI using the environment API KEY.
 */
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateMarketingImage = async (
  variationLabel: string,
  config: {
    category: CategoryType;
    model: ModelType;
    location: LocationType;
    angle: AngleType;
    pose: PoseType;
    productBase64?: string;
    faceBase64?: string;
    extraPrompt?: string;
  }
): Promise<{ url: string; prompt: string }> => {
  return fetchWithRetry(async () => {
    const locationAnchors = {
      [LocationType.STUDIO_WHITE]: "A professional minimalist studio with a clean seamless white cyclorama background, soft high-key studio lighting.",
      [LocationType.STUDIO_DARK]: "A moody professional studio with dark charcoal grey textured walls, dramatic low-key rim lighting.",
      [LocationType.BEDROOM]: "A cozy modern bedroom with light oak wood furniture, soft natural morning light.",
      [LocationType.CAFE]: "A modern boutique cafe interior with warm wooden tables, warm hanging bulbs.",
      [LocationType.TERRACE]: "A bright outdoor house terrace with white tiled floor, some tropical plants.",
      [LocationType.MALL]: "A high-end modern shopping mall interior with glossy floors, luxury storefronts.",
      [LocationType.BOUTIQUE]: "An exclusive clothing boutique with minimalist gold racks, beige carpet.",
      [LocationType.CLOTHING_STORE]: "A trendy urban clothing store with industrial decor, exposed brick walls."
    };

    const poseAnchors = {
      [PoseType.STANDING]: "Standing upright naturally and confidently in the center of the frame.",
      [PoseType.INVITING]: "Standing upright and gesturing towards the camera with an open, welcoming hand gesture.",
      [PoseType.LEANING]: "Leaning comfortably against a wall, body tilted back against the surface.",
      [PoseType.SITTING]: "Sitting down on a chair or element of the environment in a relaxed and stylish manner."
    };

    const categoryContext = {
      [CategoryType.FASHION]: "Photography style: High-end fashion editorial. Sharp focus, professional color grading. Focus on clothing details.",
      [CategoryType.UGC]: "Photography style: Authentic User Generated Content. Real-life lighting. Authentic feel.",
      [CategoryType.HOME_DECOR]: "Photography style: Interior photography. Clean aesthetic, architectural lines."
    }[config.category];

    const consistencyRule = config.category === CategoryType.FASHION 
      ? "CLOTHING CONSISTENCY: The model MUST wear the EXACT SAME clothing item shown in the Product Image. The color, pattern, texture, fabric, and design of the clothing must be 100% identical. Treat this as a single photoshoot with one outfit."
      : "CONSISTENCY: Use provided images for product and facial features reference.";

    // Pertegas instruksi angle Full Body
    const angleInstruction = config.angle === AngleType.FULL_BODY 
      ? "Wide Angle Full Body Shot. The image MUST show the model from Head to Toe. Do not crop the feet. Do not crop the head. Ensure shoes are visible."
      : config.angle;

    const baseEnvironment = locationAnchors[config.location];
    const poseContext = poseAnchors[config.pose];
    const modelRef = config.model === ModelType.PRODUCT_ONLY ? 'The product alone' : `A ${config.model} person wearing or holding the product`;

    const prompt = `
      TASK: Create variation "${variationLabel}" of a marketing image.
      ENVIRONMENT: ${baseEnvironment}.
      STYLE: ${categoryContext}. 
      SUBJECT: ${modelRef}. 
      FRAMING: ${angleInstruction}. 
      POSE: ${poseContext}.
      ${consistencyRule}
      ${config.faceBase64 ? "FACE CONSISTENCY: Use the face from the Face Reference image." : ""}
      
      CRITICAL NEGATIVE CONSTRAINTS (STRICTLY FOLLOW):
      1. NO TEXT.
      2. NO WATERMARKS.
      3. NO LOGOS.
      4. NO TYPOGRAPHY.
      5. NO OVERLAY TEXT.
      The image must be completely clean of any written words or symbols.
      
      QUALITY: Photorealistic, 8k resolution, highly detailed, sharp focus.
    `;

    const parts: any[] = [{ text: prompt }];
    if (config.productBase64) parts.push({ inlineData: { data: config.productBase64, mimeType: 'image/png' } });
    if (config.faceBase64) parts.push({ inlineData: { data: config.faceBase64, mimeType: 'image/png' } });

    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: { imageConfig: { aspectRatio: "9:16" } }
    });

    let imageUrl = "";
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) { imageUrl = `data:image/png;base64,${part.inlineData.data}`; break; }
      }
    }
    if (!imageUrl) throw new Error("API tidak mengembalikan gambar.");
    return { url: imageUrl, prompt };
  });
};

export const generateVideoPrompt = async (imagePrompt: string, category: CategoryType): Promise<string> => {
  return fetchWithRetry(async () => {
    const prompt = `Ubah deskripsi gambar berikut menjadi prompt gerakan video pendek 5 detik dalam bahasa Indonesia. Fokus pada gerakan kamera sinematik. Deskripsi: "${imagePrompt}"`;
    const ai = getAI();
    const response = await ai.models.generateContent({ 
      model: 'gemini-3-flash-preview', 
      contents: prompt,
      config: { systemInstruction: "Berikan jawaban hanya berupa prompt video dalam bahasa Indonesia, singkat dan padat." }
    });
    return response.text?.trim() || "";
  });
};

export const generateShortVOScript = async (imagePrompt: string, role: string, productName: string = ""): Promise<string> => {
    return fetchWithRetry(async () => {
        const productContext = productName ? `untuk produk "${productName}"` : "";
        const prompt = `Buat 1 kalimat narasi SUPER SINGKAT (MAKSIMAL 8 KATA) dalam bahasa Indonesia ${productContext}. Harus sangat pendek agar durasi bicara di bawah 5 detik. Gunakan bahasa gaul/TikTok/racun affiliate. Konteks Gambar: "${imagePrompt}" Peran: "${role}"`;
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { systemInstruction: "Hanya berikan 1 kalimat super pendek (maksimal 8 kata). Jangan ada tanda kutip. Harus to-the-point dan persuasif." }
        });
        return response.text?.trim() || "";
    });
};

export const generateVoiceOver = async (text: string, gender: Gender, style: VoiceStyle, tempo: Tempo, maxDuration: number = 5): Promise<Blob> => {
  return fetchWithRetry(async () => {
    const voiceName = gender === Gender.FEMALE ? 'Kore' : 'Charon';
    const cleanText = text.replace(/\[Klip \d+\]/gi, "").trim();

    const naturalInstruction = "Gunakan intonasi Bahasa Indonesia sehari-hari yang luwes. PENTING: Bicara dengan kecepatan yang pas agar durasi audio TOTAL tidak lebih dari 5 detik. Jangan ada jeda lama di awal atau di akhir.";
    const deepInstruction = gender === Gender.MALE ? "Suara pria deep, maskulin, santai." : "Suara wanita ceria, energetik.";

    const prompt = `${naturalInstruction} Gaya: ${style}. Tempo: ${tempo}. ${deepInstruction} Teks: "${cleanText}"`;

    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { 
          voiceConfig: { prebuiltVoiceConfig: { voiceName } } 
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
    if (!base64Audio) throw new Error("Gagal mengambil data audio.");
    
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    
    const header = new Uint8Array(44);
    const view = new DataView(header.buffer);
    const writeStr = (off: number, str: string) => { for(let i=0; i<str.length; i++) view.setUint8(off+i, str.charCodeAt(i)); };
    writeStr(0, 'RIFF'); 
    view.setUint32(4, 36 + bytes.length, true); 
    writeStr(8, 'WAVE'); 
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true); 
    view.setUint16(20, 1, true); 
    view.setUint16(22, 1, true); 
    view.setUint32(24, 24000, true); 
    view.setUint32(28, 48000, true); 
    view.setUint16(32, 2, true); 
    view.setUint16(34, 16, true);
    writeStr(36, 'data'); 
    view.setUint32(40, bytes.length, true);

    const wav = new Uint8Array(44 + bytes.length);
    wav.set(header); wav.set(bytes, 44);
    return new Blob([wav], { type: 'audio/wav' });
  });
};

export const generateScriptSuggestion = async (clips: VideoClip[], idea: string, platform: Platform, transitionDuration: number, category?: CategoryType): Promise<string> => {
  return fetchWithRetry(async () => {
    const prompt = `Buat naskah video pendek 4 bagian SANGAT SINGKAT tentang "${idea}". 
    Tiap bagian maksimal 8 kata agar durasi di bawah 5 detik per klip. 
    Bahasa gaul, natural, persuasif. Format wajib [Klip 1], [Klip 2], [Klip 3], [Klip 4]. Jangan tambahkan teks lain.`;
    
    const ai = getAI();
    const response = await ai.models.generateContent({ 
      model: "gemini-3-flash-preview", 
      contents: prompt,
      config: { temperature: 0.9, systemInstruction: "Hanya berikan naskah dalam format [Klip 1], [Klip 2], [Klip 3], [Klip 4]. Tiap baris harus sangat pendek (maksimal 8 kata)." }
    });
    return response.text?.trim() || "";
  });
};

export const generateProductDescription = async (idea: string, platform: Platform, category: CategoryType): Promise<string> => {
  return fetchWithRetry(async () => {
    const prompt = `Buat 1 caption video affiliate untuk produk ${idea} di ${platform}. Gunakan bahasa sehari-hari yang persuasif.`;
    const ai = getAI();
    const response = await ai.models.generateContent({ 
      model: "gemini-3-flash-preview", 
      contents: prompt,
      config: { systemInstruction: "Berikan hanya teks caption saja dengan gaya bahasa sehari-hari yang menarik." }
    });
    return response.text?.trim() || "";
  });
};
