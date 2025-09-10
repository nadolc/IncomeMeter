import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  GestureResponderEvent,
  AccessibilityRole,
  AccessibilityState,
} from 'react-native';
import { COLORS, TYPOGRAPHY, ACCESSIBILITY_CONFIG } from '../../constants/config';

interface AccessibleCardProps {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  variant?: 'default' | 'elevated' | 'outlined' | 'filled';
  padding?: 'small' | 'medium' | 'large';
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  style?: ViewStyle;
  titleStyle?: TextStyle;
  subtitleStyle?: TextStyle;
  testID?: string;
}

const AccessibleCard: React.FC<AccessibleCardProps> = ({
  title,
  subtitle,
  children,
  onPress,
  disabled = false,
  variant = 'default',
  padding = 'medium',
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole,
  accessibilityState,
  style,
  titleStyle,
  subtitleStyle,
  testID,
}) => {
  const getCardStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      backgroundColor: COLORS.primary.background,
      borderRadius: 12,
      opacity: disabled ? 0.6 : 1,
    };

    // Padding styles
    const paddingStyles: { [key: string]: ViewStyle } = {
      small: {
        padding: 12,
      },
      medium: {
        padding: 16,
      },
      large: {
        padding: 20,
      },
    };

    // Variant styles
    const variantStyles: { [key: string]: ViewStyle } = {
      default: {
        backgroundColor: COLORS.primary.background,
      },
      elevated: {
        backgroundColor: COLORS.primary.background,
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      },
      outlined: {
        backgroundColor: COLORS.primary.background,
        borderWidth: 1,
        borderColor: '#e0e0e0',
      },
      filled: {
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: 'transparent',
      },
    };

    return {
      ...baseStyle,
      ...paddingStyles[padding],
      ...variantStyles[variant],
    };
  };

  const getTitleStyle = (): TextStyle => {
    return {
      fontSize: TYPOGRAPHY.heading,
      fontWeight: TYPOGRAPHY.fontWeight.semibold,
      color: COLORS.primary.text,
      lineHeight: TYPOGRAPHY.heading * TYPOGRAPHY.lineHeight.body,
      marginBottom: subtitle ? 4 : 0,
    };
  };

  const getSubtitleStyle = (): TextStyle => {
    return {
      fontSize: TYPOGRAPHY.body,
      fontWeight: TYPOGRAPHY.fontWeight.regular,
      color: COLORS.primary.text,
      opacity: 0.8,
      lineHeight: TYPOGRAPHY.body * TYPOGRAPHY.lineHeight.body,
      marginBottom: children ? 12 : 0,
    };
  };

  const effectiveAccessibilityRole: AccessibilityRole = accessibilityRole || (onPress ? 'button' : 'text');
  const effectiveAccessibilityLabel = accessibilityLabel || [title, subtitle].filter(Boolean).join(', ');
  
  const combinedAccessibilityState: AccessibilityState = {
    disabled,
    ...accessibilityState,
  };

  const CardContent = () => (
    <View>
      {title && (
        <Text
          style={[getTitleStyle(), titleStyle]}
          accessible={!onPress} // If card is pressable, let the parent handle accessibility
          accessibilityRole={onPress ? undefined : "header"}
          numberOfLines={2}
          adjustsFontSizeToFit
        >
          {title}
        </Text>
      )}
      
      {subtitle && (
        <Text
          style={[getSubtitleStyle(), subtitleStyle]}
          accessible={!onPress} // If card is pressable, let the parent handle accessibility
          numberOfLines={3}
          adjustsFontSizeToFit
        >
          {subtitle}
        </Text>
      )}
      
      {children}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={[getCardStyle(), style]}
        onPress={disabled ? undefined : onPress}
        disabled={disabled}
        accessible={true}
        accessibilityRole={effectiveAccessibilityRole}
        accessibilityLabel={effectiveAccessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={combinedAccessibilityState}
        testID={testID}
        activeOpacity={disabled ? 1 : 0.8}
        delayPressIn={100}
      >
        <CardContent />
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={[getCardStyle(), style]}
      accessible={true}
      accessibilityRole={effectiveAccessibilityRole}
      accessibilityLabel={effectiveAccessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
    >
      <CardContent />
    </View>
  );
};

export default AccessibleCard;