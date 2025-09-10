import { ViewStyle } from 'react-native';

export interface OnboardingFlowProps {
  onComplete: (userData: any) => void;
  style?: ViewStyle;
  testID?: string;
}

export interface OnboardingStepProps {
  step: import('../../types').OnboardingStep;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onSkip?: () => void;
  onComplete: () => void;
  isLastStep: boolean;
  style?: ViewStyle;
  testID?: string;
}

export interface WelcomeStepProps {
  onNext: () => void;
  onSkip?: () => void;
  onComplete: () => void;
  currentStep: number;
  totalSteps: number;
}

export interface PermissionsStepProps {
  onNext: () => void;
  onSkip?: () => void;
  onComplete: () => void;
  currentStep: number;
  totalSteps: number;
}