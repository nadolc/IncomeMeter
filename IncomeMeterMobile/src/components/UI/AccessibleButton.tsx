import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  AccessibilityState,
  AccessibilityRole,
  GestureResponderEvent,
} from 'react-native';
import { COLORS, TYPOGRAPHY, ACCESSIBILITY_CONFIG } from '../../constants/config';

interface AccessibleButtonProps {
  onPress: (event: GestureResponderEvent) => void;
  title: string;
  variant?: 'primary' | 'secondary' | 'success' | 'error' | 'warning';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
}

const AccessibleButton: React.FC<AccessibleButtonProps> = ({
  onPress,
  title,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  accessibilityState,
  style,
  textStyle,
  testID,
}) => {
  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      opacity: disabled || loading ? 0.6 : 1,
    };

    // Size-based styles
    const sizeStyles: { [key: string]: ViewStyle } = {
      small: {
        minHeight: ACCESSIBILITY_CONFIG.minimumTouchTarget,
        paddingHorizontal: 16,
        paddingVertical: 8,
      },
      medium: {
        minHeight: ACCESSIBILITY_CONFIG.recommendedTouchTarget,
        paddingHorizontal: 24,
        paddingVertical: 12,
      },
      large: {
        minHeight: 56,
        paddingHorizontal: 32,
        paddingVertical: 16,
      },
    };

    // Variant-based styles
    const variantStyles: { [key: string]: ViewStyle } = {
      primary: {
        backgroundColor: COLORS.primary.contrast,
        borderColor: COLORS.primary.contrast,
      },
      secondary: {
        backgroundColor: COLORS.primary.background,
        borderColor: COLORS.primary.contrast,
      },
      success: {
        backgroundColor: COLORS.success.border,
        borderColor: COLORS.success.border,
      },
      error: {
        backgroundColor: COLORS.error.border,
        borderColor: COLORS.error.border,
      },
      warning: {
        backgroundColor: COLORS.warning.border,
        borderColor: COLORS.warning.border,
      },
    };

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...variantStyles[variant],
    };
  };

  const getTextStyle = (): TextStyle => {
    const baseStyle: TextStyle = {
      fontWeight: TYPOGRAPHY.fontWeight.medium,
      textAlign: 'center',
      includeFontPadding: false,
      textAlignVertical: 'center',
    };

    // Size-based text styles
    const sizeStyles: { [key: string]: TextStyle } = {
      small: {
        fontSize: TYPOGRAPHY.small,
        lineHeight: TYPOGRAPHY.small * TYPOGRAPHY.lineHeight.small,
      },
      medium: {
        fontSize: TYPOGRAPHY.body,
        lineHeight: TYPOGRAPHY.body * TYPOGRAPHY.lineHeight.body,
      },
      large: {
        fontSize: TYPOGRAPHY.large,
        lineHeight: TYPOGRAPHY.large * TYPOGRAPHY.lineHeight.large,
      },
    };

    // Variant-based text styles
    const variantTextStyles: { [key: string]: TextStyle } = {
      primary: {
        color: COLORS.primary.background,
      },
      secondary: {
        color: COLORS.primary.contrast,
      },
      success: {
        color: COLORS.primary.background,
      },
      error: {
        color: COLORS.primary.background,
      },
      warning: {
        color: COLORS.primary.background,
      },
    };

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...variantTextStyles[variant],
    };
  };

  const combinedAccessibilityState: AccessibilityState = {
    disabled: disabled || loading,
    busy: loading,
    ...accessibilityState,
  };

  const buttonTitle = loading ? 'Loading...' : title;
  const effectiveAccessibilityLabel = accessibilityLabel || buttonTitle;
  const effectiveAccessibilityHint = accessibilityHint || (loading ? 'Button is loading, please wait' : undefined);

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      onPress={disabled || loading ? undefined : onPress}
      disabled={disabled || loading}
      accessible={true}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={effectiveAccessibilityLabel}
      accessibilityHint={effectiveAccessibilityHint}
      accessibilityState={combinedAccessibilityState}
      testID={testID}
      activeOpacity={disabled || loading ? 1 : 0.7}
    >
      <Text style={[getTextStyle(), textStyle]} numberOfLines={1} adjustsFontSizeToFit>
        {buttonTitle}
      </Text>
    </TouchableOpacity>
  );
};

export default AccessibleButton;