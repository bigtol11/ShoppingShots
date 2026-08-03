export type ProjectStatus =
  | 'DRAFT'
  | 'PRODUCT_ANALYZED'
  | 'SOURCE_SEARCHING'
  | 'SOURCE_REVIEW'
  | 'SCRIPT_GENERATED'
  | 'CLIPS_MATCHED'
  | 'AI_CLIPS_GENERATING'
  | 'RENDERING'
  | 'QUALITY_CHECK'
  | 'READY'
  | 'FAILED';

export type SourceGrade = 'A' | 'B' | 'C' | 'REJECT';

export interface VerifiedClaim {
  claim_id: string;
  claim: string;
  status: 'VERIFIED' | 'PARTIAL' | 'UNVERIFIED' | 'CONTRADICTED';
  source: string;
  safe_wording: string;
}

export interface ProductFacts {
  product_id: string;
  product_name: string;
  category_name: string;
  source_url?: string;
  price?: string;
  vendor_item_id?: string;
  verified_facts: VerifiedClaim[];
  category_facts: string[];
  use_cases: string[];
  visual_features: string[];
  prohibited_claims: string[];
  search_terms: {
    ko: string[];
    zh: string[];
    en: string[];
  };
  reviews_summary?: {
    total_reviews: number;
    key_points: string[];
  };
}

export interface ScriptCandidate {
  id: string;
  title: string;
  style: string; // e.g. '인스타 생활설득형', '썰쇼츠형', '살림/생활 직설형'
  target_duration_sec: number;
  full_text: string;
  hook_type: string;
  risk_notes: string[];
  confidence_score: number;
}

export interface SceneItem {
  scene_id: string;
  order: number;
  start_time: number;
  end_time: number;
  duration: number;
  purpose: 'visual_hook' | 'problem_statement' | 'product_reveal' | 'core_mechanism' | 'use_case' | 'cta_loop';
  narration: string;
  subtitle: string;
  required_visual: string;
  preferred_source_grade: SourceGrade;
  selected_clip_id?: string;
  source_type: 'EXISTING' | 'AI' | 'PRODUCT_IMAGE';
  transition: 'HARD_CUT' | 'FADE' | 'KEN_BURNS';
  ken_burns_motion?: 'ZOOM_IN' | 'PAN_LEFT' | 'PAN_RIGHT' | 'PAN_UP' | 'NONE';
  effect_sound?: string;
  ai_prompt?: string;
  // Still-image compositing prompt (background/lighting/composition only, product excluded)
  // produced by /api/analyze-benchmark-video — consumed by
  // /api/generate-benchmark-reference-image before the ai_prompt motion step runs.
  fal_reference_prompt?: string;
  // The user's real product photo (already uploaded, stored URL) that
  // /api/generate-benchmark-reference-image composites into fal_reference_prompt's scene.
  product_reference_image_url?: string;
  media_url?: string;
  custom_audio_url?: string;
  tts_generated?: boolean;
}

export interface ClipCandidate {
  clip_id: string;
  source_id: string;
  title: string;
  start_sec: number;
  end_sec: number;
  duration: number;
  source_grade: SourceGrade;
  similarity_score: number;
  subtitle_difficulty: 'LOW' | 'MEDIUM' | 'HIGH';
  rights_status: 'VERIFIED' | 'USER_CONFIRMED' | 'UNKNOWN';
  thumbnail_url: string;
  video_url: string;
}

export interface AudioConfig {
  voice_id: string;
  voice_name: string;
  voice_provider?: 'gemini' | 'typecast' | 'elevenlabs';
  gender: 'female' | 'male';
  speed: number;
  emotion_style: string;
  bgm_id: string;
  bgm_volume: number;
  // Combined narration audio for the full scene sequence, generated once via /api/generate-tts
  // and carried through to /api/render-video so the final render uses real narration.
  narrationAudioBase64?: string;
  // 'gemini_pcm' = raw 16-bit PCM @24kHz mono (needs explicit ffmpeg -f s16le on render);
  // 'wav' = a real WAV container (e.g. Typecast) that ffmpeg can read directly.
  narrationAudioFormat?: 'gemini_pcm' | 'wav';
  narrationGeneratedAt?: string;
}

export interface UserSettings {
  typecastApiKey?: string;
  elevenlabsApiKey?: string;
  plan: 'FREE' | 'PRO' | 'ENTERPRISE';
  monthlyRendersUsed: number;
  monthlyRendersLimit: number;
  ttsCharsUsed: number;
  ttsCharsLimit: number;
  useSystemFallbackKey: boolean;
}

export interface AdminStats {
  totalUsers: number;
  activeJobs: number;
  systemGpuHealth: 'OPERATIONAL' | 'DEGRADED';
  geminiApiStatus: 'ONLINE' | 'ERROR';
  typecastAdapterStatus: 'CONNECTED' | 'DISCONNECTED';
  elevenlabsAdapterStatus: 'CONNECTED' | 'DISCONNECTED';
  ffmpegQueueLength: number;
}

export interface QualityReport {
  overall_status: 'PASS' | 'PASS_WITH_WARNING' | 'REVIEW_REQUIRED' | 'FAIL';
  duration_valid: boolean;
  aspect_ratio_valid: boolean;
  subtitles_safety_zone: boolean;
  fact_check_passed: boolean;
  copyright_risk_score: number;
  warnings: string[];
  recommendations: string[];
}

export interface PipelineV2Response {
  fact_check: {
    verified_specs: string[];
    corrected_hallucinations: string[];
    killer_fact: string;
  };
  thumbnail: {
    visual_composition: string;
    key_copy: string;
    title_a: string;
    title_b: string;
  };
  script_timeline: {
    scene_id: string;
    section_name: string;
    duration_sec: number;
    narration_text: string;
    visual_editing_guide: string;
  }[];
}

export interface ProjectData {
  id: string;
  name: string;
  updatedAt: string;
  status: ProjectStatus;
  productInfo: ProductFacts;
  pipelineV2Data?: PipelineV2Response;
  selectedScriptId?: string;
  scripts: ScriptCandidate[];
  scenes: SceneItem[];
  clipCandidates: ClipCandidate[];
  audioConfig: AudioConfig;
  qualityReport?: QualityReport;
  targetPlatform: 'youtube_shorts' | 'tiktok' | 'instagram_reels';
  targetDuration: number;
}

export interface CompletedProject {
  id: string;
  title: string;
  productName: string;
  createdAt: string;
  durationSec: number;
  videoUrl: string;
  thumbnailUrl: string;
  fileSizeMb: number;
  resolution: string;
  fps: number;
  srtContent: string;
  metaData: {
    youtubeTitle: string;
    hashtags: string[];
    description: string;
  };
  safetyScore: number;
  safetyStatus: 'VERY_SAFE' | 'SAFE' | 'CAUTION';
  complianceDetails: {
    exaggeratedPhrasesFixed: number;
    coupangNoticeInserted: boolean;
    copyrightGrade: 'A' | 'B';
    reusedContentRisk: number;
  };
}
