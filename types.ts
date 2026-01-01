
export enum Gender {
  FEMALE = 'Female',
  MALE = 'Male',
}

export enum VoiceStyle {
  ENTHUSIASTIC = 'Enthusiastic',
  PROFESSIONAL = 'Professional',
  CALM = 'Calm',
  DRAMATIC = 'Dramatic',
  NEWSCASTER = 'Newscaster',
  NORMAL = 'Normal',
}

export enum Tempo {
  NORMAL = 'Normal',
  SOMEWHAT_FAST = 'Somewhat Fast',
  FAST = 'Fast',
}

export enum TransitionMode {
  CROSS_FADE = 'Cross Fade',
  FADE_TO_BLACK = 'Fade to Black',
}

export enum SubtitleMode {
  STATIC = 'Static',
  DYNAMIC = 'Dynamic',
}

export enum Platform {
  TIKTOK = 'TikTok (Keranjang Kuning)',
  SHOPEE = 'Shopee (Keranjang Orange)',
}

export enum ModelType {
  HIJAB = 'Wanita Berhijab',
  NON_HIJAB = 'Wanita Non Hijab',
  MALE = 'Pria Casual',
  MANNEQUIN = 'Manekin',
  PRODUCT_ONLY = 'Product Only',
}

export enum CategoryType {
  FASHION = 'Fashion',
  UGC = 'UGC (User Content)',
  HOME_DECOR = 'Home Decor',
}

export enum LocationType {
  STUDIO_WHITE = 'Studio Putih Estetik',
  STUDIO_DARK = 'Studio Gelap Estetik',
  BEDROOM = 'Kamar Tidur Estetik',
  CAFE = 'Cafe Estetik',
  TERRACE = 'Teras Rumah Estetik',
  MALL = 'Mall Estetik',
  BOUTIQUE = 'Butik Estetik',
  CLOTHING_STORE = 'Toko Baju Estetik',
}

export enum AngleType {
  FULL_BODY = 'Full Body',
  WAIST_UP = 'Setengah Body',
  POV = 'POV',
}

export enum PoseType {
  STANDING = 'Berdiri',
  INVITING = 'Berdiri Mengajak',
  LEANING = 'Bersandar',
  SITTING = 'Duduk',
}

export interface VideoClip {
  id: string;
  file?: File;
  url?: string;
  duration: number;
  thumbnail?: string;
  isVirtual?: boolean;
  label?: string;
}

export interface VOConfig {
  gender: Gender;
  style: VoiceStyle;
  tempo: Tempo;
  text: string;
  idea: string;
  targetDuration: number;
  repeat: boolean;
  platform: Platform;
}

export interface MarketingImage {
  id: string;
  label: string;
  url: string | null;
  prompt: string;
  videoPrompt?: string | null;
  isVideoPromptGenerating?: boolean;
  audioUrl?: string | null;
  audioScript?: string | null;
  isAudioGenerating?: boolean;
}
