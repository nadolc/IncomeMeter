import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Image,
} from 'react-native';
import { COLORS, TYPOGRAPHY } from '../../../constants/config';
import { AccessibleCard } from '../../ui';

interface WelcomeStepProps {
  onNext: () => void;
  onSkip?: () => void;
  onComplete: () => void;
  currentStep: number;
  totalSteps: number;
}

const WelcomeStep: React.FC<WelcomeStepProps> = ({
  onNext,
  onSkip,
  onComplete,
  currentStep,
  totalSteps,
}) => {
  const features = [
    {
      icon: '📍',
      title: 'Smart GPS Tracking',
      description: 'Precision route tracking with GPS accuracy and battery optimization',
    },
    {
      icon: '💰',
      title: 'Income Management',
      description: 'Track earnings from multiple sources with real-time analytics',
    },
    {
      icon: '📊',
      title: 'Detailed Analytics',
      description: 'Comprehensive reports and insights to optimize your work',
    },
    {
      icon: '🔒',
      title: 'Secure & Private',
      description: 'Your data is encrypted and stored securely on your device',
    },
  ];

  const getContainerStyle = (): ViewStyle => {
    return {
      flex: 1,
      paddingVertical: 20,
    };
  };

  const getLogoContainerStyle = (): ViewStyle => {
    return {
      alignItems: 'center',
      marginBottom: 40,
    };
  };

  const getLogoStyle = (): TextStyle => {
    return {
      fontSize: 64,
      marginBottom: 16,
    };
  };

  const getAppNameStyle = (): TextStyle => {
    return {
      fontSize: 24,
      fontWeight: TYPOGRAPHY.fontWeight.bold,
      color: COLORS.primary.text,
      textAlign: 'center',
      marginBottom: 8,
    };
  };

  const getTaglineStyle = (): TextStyle => {
    return {
      fontSize: TYPOGRAPHY.body,
      color: COLORS.primary.text,
      opacity: 0.8,
      textAlign: 'center',
    };
  };

  const getFeaturesContainerStyle = (): ViewStyle => {
    return {
      flex: 1,
      gap: 16,
    };
  };

  const getFeatureCardStyle = (): ViewStyle => {
    return {
      marginBottom: 8,
    };
  };

  const getFeatureContentStyle = (): ViewStyle => {
    return {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 16,
    };
  };

  const getFeatureIconStyle = (): TextStyle => {
    return {
      fontSize: 24,
      lineHeight: 30,
    };
  };

  const getFeatureTextContainerStyle = (): ViewStyle => {
    return {
      flex: 1,
    };
  };

  const getFeatureTitleStyle = (): TextStyle => {
    return {
      fontSize: TYPOGRAPHY.body,
      fontWeight: TYPOGRAPHY.fontWeight.semibold,
      color: COLORS.primary.text,
      marginBottom: 4,
    };
  };

  const getFeatureDescriptionStyle = (): TextStyle => {
    return {
      fontSize: TYPOGRAPHY.small,
      color: COLORS.primary.text,
      opacity: 0.8,
      lineHeight: TYPOGRAPHY.small * TYPOGRAPHY.lineHeight.small,
    };
  };

  return (
    <View
      style={getContainerStyle()}
      accessible={false}
    >
      {/* App Logo and Name */}
      <View style={getLogoContainerStyle()}>
        <Text
          style={getLogoStyle()}
          accessible={true}
          accessibilityRole="image"
          accessibilityLabel="IncomeMeter app icon"
        >
          🚗
        </Text>
        <Text
          style={getAppNameStyle()}
          accessible={true}
          accessibilityRole="header"
          accessibilityLevel={2}
        >
          IncomeMeter Mobile
        </Text>
        <Text
          style={getTaglineStyle()}
          accessible={true}
          accessibilityRole="text"
        >
          Your intelligent route tracking companion
        </Text>
      </View>

      {/* Features List */}
      <View style={getFeaturesContainerStyle()}>
        {features.map((feature, index) => (
          <AccessibleCard
            key={index}
            variant="outlined"
            padding="medium"
            style={getFeatureCardStyle()}
            accessibilityLabel={`${feature.title}: ${feature.description}`}
            testID={`welcome-feature-${index}`}
          >
            <View style={getFeatureContentStyle()}>
              <Text
                style={getFeatureIconStyle()}
                accessible={true}
                accessibilityRole="image"
                accessibilityLabel={`${feature.title} icon`}
              >
                {feature.icon}
              </Text>
              <View style={getFeatureTextContainerStyle()}>
                <Text style={getFeatureTitleStyle()}>
                  {feature.title}
                </Text>
                <Text style={getFeatureDescriptionStyle()}>
                  {feature.description}
                </Text>
              </View>
            </View>
          </AccessibleCard>
        ))}
      </View>
    </View>
  );
};

export default WelcomeStep;