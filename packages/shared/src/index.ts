// Coping mechanism configuration constants

export interface BreathingPhase {
  name: 'Inhale' | 'Hold (In)' | 'Exhale' | 'Hold (Out)';
  durationSeconds: number;
  instruction: string;
}

export const BOX_BREATHING_PHASES: BreathingPhase[] = [
  {
    name: 'Inhale',
    durationSeconds: 4,
    instruction: 'Breathe in slowly through your nose...',
  },
  {
    name: 'Hold (In)',
    durationSeconds: 4,
    instruction: 'Hold your breath and feel the stillness...',
  },
  {
    name: 'Exhale',
    durationSeconds: 4,
    instruction: 'Exhale completely through your mouth...',
  },
  {
    name: 'Hold (Out)',
    durationSeconds: 4,
    instruction: 'Hold before your next breath...',
  },
];

export interface GroundingStep {
  stepNumber: number; // 5, 4, 3, 2, 1
  sensoryType: 'sight' | 'touch' | 'sound' | 'smell' | 'taste';
  sensoryLabel: string;
  prompt: string;
  expectedCount: number;
}

export const GROUNDING_STEPS: GroundingStep[] = [
  {
    stepNumber: 5,
    sensoryType: 'sight',
    sensoryLabel: 'See',
    prompt: 'Name 5 things you can see around you.',
    expectedCount: 5,
  },
  {
    stepNumber: 4,
    sensoryType: 'touch',
    sensoryLabel: 'Touch',
    prompt: 'Name 4 things you can physically feel or touch right now.',
    expectedCount: 4,
  },
  {
    stepNumber: 3,
    sensoryType: 'sound',
    sensoryLabel: 'Hear',
    prompt: 'Name 3 things you can hear in your environment.',
    expectedCount: 3,
  },
  {
    stepNumber: 2,
    sensoryType: 'smell',
    sensoryLabel: 'Smell',
    prompt: 'Name 2 things you can smell or list smells you appreciate.',
    expectedCount: 2,
  },
  {
    stepNumber: 1,
    sensoryType: 'taste',
    sensoryLabel: 'Taste',
    prompt: 'Name 1 thing you can taste or imagine tasting.',
    expectedCount: 1,
  },
];

// Types for API communication
export interface GroundingLogEntry {
  stepNumber: number;
  items: string[];
}

export interface GroundingSessionInput {
  logs: GroundingLogEntry[];
  userDistressBefore: number; // 1-10 scale
  userDistressAfter?: number; // 1-10 scale
}

export interface GroundingFeedbackResponse {
  message: string;      // Soothing, validating comment from AI
  suggestedAction: string; // Next step suggestion (e.g. do breathing, journal, rest)
}
