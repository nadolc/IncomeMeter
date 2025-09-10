export { default as OnboardingFlow } from './OnboardingFlow';
export { default as OnboardingStep } from './OnboardingStep';

// Export step components
export { default as WelcomeStep } from './steps/WelcomeStep';
export { default as PermissionsStep } from './steps/PermissionsStep';

// Re-export types if needed
export type {
  OnboardingFlowProps,
  OnboardingStepProps,
  WelcomeStepProps,
  PermissionsStepProps,
} from './types';