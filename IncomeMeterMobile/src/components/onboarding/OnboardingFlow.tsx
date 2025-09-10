import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  Dimensions,
  BackHandler,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../../constants/config';
import { OnboardingStep as OnboardingStepType, OnboardingProgress } from '../../types';
import OnboardingStepComponent from './OnboardingStep';
import WelcomeStep from './steps/WelcomeStep';
import PermissionsStep from './steps/PermissionsStep';

interface OnboardingFlowProps {
  onComplete: (userData: any) => void;
  style?: ViewStyle;
  testID?: string;
}

const ONBOARDING_STORAGE_KEY = '@IncomeMeter:onboardingProgress';
const ONBOARDING_COMPLETED_KEY = '@IncomeMeter:onboardingCompleted';

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  onComplete,
  style,
  testID,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState<OnboardingProgress>({
    currentStep: 0,
    totalSteps: 0,
    completedSteps: [],
    userData: {},
  });

  const onboardingSteps: OnboardingStepType[] = [
    {
      id: 'welcome',
      title: 'Welcome to IncomeMeter',
      description: 'Your intelligent route tracking companion for maximizing earnings',
      component: WelcomeStep,
      skippable: false,
      required: true,
    },
    {
      id: 'permissions',
      title: 'Essential Permissions',
      description: 'Grant permissions to enable GPS tracking and notifications',
      component: PermissionsStep,
      skippable: false,
      required: true,
    },
    {
      id: 'profile',
      title: 'Create Your Profile',
      description: 'Set up your account to sync data across devices',
      component: WelcomeStep, // Placeholder - would be replaced with ProfileStep
      skippable: true,
      required: false,
    },
    {
      id: 'preferences',
      title: 'Customize Experience',
      description: 'Configure app settings to match your workflow',
      component: WelcomeStep, // Placeholder - would be replaced with PreferencesStep
      skippable: true,
      required: false,
    },
    {
      id: 'tutorial',
      title: 'Quick Tutorial',
      description: 'Learn how to track routes and manage income efficiently',
      component: WelcomeStep, // Placeholder - would be replaced with TutorialStep
      skippable: true,
      required: false,
    },
  ];

  useEffect(() => {
    initializeOnboarding();
    setupBackHandler();
    
    return () => {
      BackHandler.removeEventListener('hardwareBackPress', handleBackPress);
    };
  }, []);

  useEffect(() => {
    updateProgress();
    saveProgress();
  }, [currentStep]);

  const setupBackHandler = () => {
    BackHandler.addEventListener('hardwareBackPress', handleBackPress);
  };

  const handleBackPress = (): boolean => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      return true; // Prevent default back action
    } else {
      showExitConfirmation();
      return true; // Prevent default back action
    }
  };

  const showExitConfirmation = () => {
    Alert.alert(
      'Exit Setup',
      'Are you sure you want to exit the setup? You can complete it later from the settings.',
      [
        {
          text: 'Continue Setup',
          style: 'cancel',
        },
        {
          text: 'Exit',
          style: 'destructive',
          onPress: () => {
            // In a real app, this would navigate back to the main app
            console.log('User exited onboarding');
          },
        },
      ]
    );
  };

  const initializeOnboarding = async () => {
    try {
      const savedProgress = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (savedProgress) {
        const parsedProgress: OnboardingProgress = JSON.parse(savedProgress);
        setProgress(parsedProgress);
        setCurrentStep(parsedProgress.currentStep);
      } else {
        const initialProgress: OnboardingProgress = {
          currentStep: 0,
          totalSteps: onboardingSteps.length,
          completedSteps: [],
          userData: {},
        };
        setProgress(initialProgress);
      }
    } catch (error) {
      console.error('Error loading onboarding progress:', error);
      // Initialize with default progress
      const initialProgress: OnboardingProgress = {
        currentStep: 0,
        totalSteps: onboardingSteps.length,
        completedSteps: [],
        userData: {},
      };
      setProgress(initialProgress);
    }
  };

  const updateProgress = () => {
    setProgress(prev => ({
      ...prev,
      currentStep: currentStep + 1, // UI shows 1-based indexing
      totalSteps: onboardingSteps.length,
    }));
  };

  const saveProgress = async () => {
    try {
      const progressToSave = {
        ...progress,
        currentStep: currentStep + 1,
      };
      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(progressToSave));
    } catch (error) {
      console.error('Error saving onboarding progress:', error);
    }
  };

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      markStepCompleted(onboardingSteps[currentStep].id);
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    const currentStepData = onboardingSteps[currentStep];
    if (currentStepData.skippable) {
      if (currentStep < onboardingSteps.length - 1) {
        setCurrentStep(prev => prev + 1);
      } else {
        handleComplete();
      }
    }
  };

  const handleComplete = async () => {
    try {
      // Mark onboarding as completed
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
      
      // Clear progress since onboarding is complete
      await AsyncStorage.removeItem(ONBOARDING_STORAGE_KEY);
      
      // Mark final step as completed
      markStepCompleted(onboardingSteps[currentStep].id);
      
      // Call completion callback with collected user data
      onComplete(progress.userData);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      // Still complete onboarding even if storage fails
      onComplete(progress.userData);
    }
  };

  const markStepCompleted = (stepId: string) => {
    setProgress(prev => ({
      ...prev,
      completedSteps: [...prev.completedSteps, stepId],
    }));
  };

  const updateUserData = (data: any) => {
    setProgress(prev => ({
      ...prev,
      userData: { ...prev.userData, ...data },
    }));
  };

  const getContainerStyle = (): ViewStyle => {
    return {
      flex: 1,
      backgroundColor: COLORS.primary.background,
    };
  };

  if (currentStep >= onboardingSteps.length) {
    // This shouldn't happen, but just in case
    handleComplete();
    return null;
  }

  const currentStepData = onboardingSteps[currentStep];

  return (
    <View
      style={[getContainerStyle(), style]}
      testID={testID || 'onboarding-flow'}
    >
      <OnboardingStepComponent
        step={currentStepData}
        currentStep={currentStep + 1} // UI shows 1-based indexing
        totalSteps={onboardingSteps.length}
        onNext={handleNext}
        onSkip={currentStepData.skippable ? handleSkip : undefined}
        onComplete={handleComplete}
        isLastStep={currentStep === onboardingSteps.length - 1}
        testID={`onboarding-step-${currentStepData.id}`}
      />
    </View>
  );
};

export default OnboardingFlow;