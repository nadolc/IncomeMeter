import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Dimensions,
  ScrollView,
} from 'react-native';
import { COLORS, TYPOGRAPHY, ACCESSIBILITY_CONFIG } from '../../constants/config';
import { AccessibleButton } from '../ui';
import { OnboardingStep as OnboardingStepType } from '../../types';

interface OnboardingStepProps {
  step: OnboardingStepType;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onSkip?: () => void;
  onComplete: () => void;
  isLastStep: boolean;
  style?: ViewStyle;
  testID?: string;
}

const OnboardingStepComponent: React.FC<OnboardingStepProps> = ({
  step,
  currentStep,
  totalSteps,
  onNext,
  onSkip,
  onComplete,
  isLastStep,
  style,
  testID,
}) => {
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  const getContainerStyle = (): ViewStyle => {
    return {
      flex: 1,
      backgroundColor: COLORS.primary.background,
      paddingHorizontal: 24,
      paddingTop: 40,
      paddingBottom: 32,
    };
  };

  const getProgressBarStyle = (): ViewStyle => {
    return {
      height: 4,
      backgroundColor: '#e0e0e0',
      borderRadius: 2,
      marginBottom: 32,
      overflow: 'hidden',
    };
  };

  const getProgressFillStyle = (): ViewStyle => {
    const progressPercentage = (currentStep / totalSteps) * 100;
    return {
      height: '100%',
      backgroundColor: COLORS.primary.contrast,
      borderRadius: 2,
      width: `${progressPercentage}%`,
    };
  };

  const getTitleStyle = (): TextStyle => {
    return {
      fontSize: 28,
      fontWeight: TYPOGRAPHY.fontWeight.bold,
      color: COLORS.primary.text,
      textAlign: 'center',
      marginBottom: 16,
      lineHeight: 36,
    };
  };

  const getDescriptionStyle = (): TextStyle => {
    return {
      fontSize: TYPOGRAPHY.large,
      fontWeight: TYPOGRAPHY.fontWeight.regular,
      color: COLORS.primary.text,
      textAlign: 'center',
      lineHeight: TYPOGRAPHY.large * TYPOGRAPHY.lineHeight.large,
      opacity: 0.8,
      marginBottom: 40,
    };
  };

  const getContentContainerStyle = (): ViewStyle => {
    return {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 20,
    };
  };

  const getButtonContainerStyle = (): ViewStyle => {
    return {
      paddingTop: 24,
      gap: 12,
    };
  };

  const getStepIndicatorStyle = (): TextStyle => {
    return {
      fontSize: TYPOGRAPHY.small,
      fontWeight: TYPOGRAPHY.fontWeight.medium,
      color: COLORS.primary.text,
      textAlign: 'center',
      opacity: 0.6,
      marginBottom: 16,
    };
  };

  return (
    <View
      style={[getContainerStyle(), style]}
      accessible={true}
      accessibilityLabel={`Onboarding step ${currentStep} of ${totalSteps}: ${step.title}`}
      testID={testID || `onboarding-step-${currentStep}`}
    >
      {/* Progress Bar */}
      <View
        style={getProgressBarStyle()}
        accessible={true}
        accessibilityRole="progressbar"
        accessibilityLabel={`Step ${currentStep} of ${totalSteps} completed`}
        accessibilityValue={{ min: 0, max: totalSteps, now: currentStep }}
      >
        <View style={getProgressFillStyle()} />
      </View>

      {/* Step Indicator */}
      <Text
        style={getStepIndicatorStyle()}
        accessible={true}
        accessibilityRole="text"
        testID={testID ? `${testID}-step-indicator` : `step-indicator-${currentStep}`}
      >
        Step {currentStep} of {totalSteps}
      </Text>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        accessible={false}
      >
        <View style={getContentContainerStyle()}>
          {/* Title */}
          <Text
            style={getTitleStyle()}
            accessible={true}
            accessibilityRole="header"
            accessibilityLevel={1}
            testID={testID ? `${testID}-title` : `step-title-${currentStep}`}
          >
            {step.title}
          </Text>

          {/* Description */}
          <Text
            style={getDescriptionStyle()}
            accessible={true}
            accessibilityRole="text"
            testID={testID ? `${testID}-description` : `step-description-${currentStep}`}
          >
            {step.description}
          </Text>

          {/* Custom Step Component */}
          <View
            style={{ flex: 1, width: '100%' }}
            accessible={false}
          >
            <step.component
              onNext={onNext}
              onSkip={onSkip}
              onComplete={onComplete}
              currentStep={currentStep}
              totalSteps={totalSteps}
            />
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={getButtonContainerStyle()}>
        <AccessibleButton
          title={isLastStep ? 'Get Started' : 'Continue'}
          onPress={isLastStep ? onComplete : onNext}
          variant="primary"
          size="large"
          accessibilityLabel={isLastStep ? 'Complete onboarding and start using the app' : `Continue to step ${currentStep + 1}`}
          accessibilityHint={isLastStep ? 'This will complete the setup process' : undefined}
          testID={testID ? `${testID}-continue-button` : `step-continue-${currentStep}`}
          style={{ width: '100%' }}
        />

        {step.skippable && onSkip && !isLastStep && (
          <AccessibleButton
            title="Skip for now"
            onPress={onSkip}
            variant="secondary"
            size="large"
            accessibilityLabel="Skip this step"
            accessibilityHint={`Skip to step ${currentStep + 1} or finish onboarding`}
            testID={testID ? `${testID}-skip-button` : `step-skip-${currentStep}`}
            style={{ width: '100%' }}
          />
        )}
      </View>
    </View>
  );
};

export default OnboardingStepComponent;