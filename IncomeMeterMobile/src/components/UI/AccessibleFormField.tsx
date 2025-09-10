import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ViewStyle,
  TextStyle,
  TextInputProps,
  NativeSyntheticEvent,
  TextInputFocusEventData,
  AccessibilityState,
} from 'react-native';
import { COLORS, TYPOGRAPHY, ACCESSIBILITY_CONFIG } from '../../constants/config';

interface AccessibleFormFieldProps extends Omit<TextInputProps, 'style' | 'placeholderTextColor'> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  helperText?: string;
  required?: boolean;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  labelStyle?: TextStyle;
  errorStyle?: TextStyle;
  helperStyle?: TextStyle;
  variant?: 'default' | 'outlined' | 'filled';
  testID?: string;
}

const AccessibleFormField: React.FC<AccessibleFormFieldProps> = ({
  label,
  value,
  onChangeText,
  error,
  helperText,
  required = false,
  containerStyle,
  inputStyle,
  labelStyle,
  errorStyle,
  helperStyle,
  variant = 'default',
  testID,
  onFocus,
  onBlur,
  ...textInputProps
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleFocus = (e: NativeSyntheticEvent<TextInputFocusEventData>) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: NativeSyntheticEvent<TextInputFocusEventData>) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  const getContainerStyle = (): ViewStyle => {
    return {
      marginVertical: 8,
    };
  };

  const getLabelStyle = (): TextStyle => {
    const baseStyle: TextStyle = {
      fontSize: TYPOGRAPHY.body,
      fontWeight: TYPOGRAPHY.fontWeight.medium,
      color: COLORS.primary.text,
      marginBottom: 8,
      lineHeight: TYPOGRAPHY.body * TYPOGRAPHY.lineHeight.body,
    };

    if (error) {
      baseStyle.color = COLORS.error.text;
    } else if (isFocused) {
      baseStyle.color = COLORS.primary.contrast;
    }

    return baseStyle;
  };

  const getInputStyle = (): ViewStyle & TextStyle => {
    const baseStyle: ViewStyle & TextStyle = {
      minHeight: ACCESSIBILITY_CONFIG.recommendedTouchTarget,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: TYPOGRAPHY.body,
      lineHeight: TYPOGRAPHY.body * TYPOGRAPHY.lineHeight.body,
      color: COLORS.primary.text,
      borderRadius: 8,
      borderWidth: 2,
      backgroundColor: COLORS.primary.background,
    };

    // Variant-based styles
    const variantStyles: { [key: string]: ViewStyle } = {
      default: {
        borderColor: error ? COLORS.error.border : (isFocused ? COLORS.primary.contrast : '#e0e0e0'),
      },
      outlined: {
        borderColor: error ? COLORS.error.border : (isFocused ? COLORS.primary.contrast : '#e0e0e0'),
        backgroundColor: 'transparent',
      },
      filled: {
        borderColor: 'transparent',
        backgroundColor: error ? COLORS.error.background : '#f5f5f5',
        borderBottomColor: error ? COLORS.error.border : (isFocused ? COLORS.primary.contrast : '#e0e0e0'),
        borderBottomWidth: 2,
        borderRadius: 8,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
      },
    };

    return {
      ...baseStyle,
      ...variantStyles[variant],
    };
  };

  const getHelperTextStyle = (): TextStyle => {
    return {
      fontSize: TYPOGRAPHY.small,
      lineHeight: TYPOGRAPHY.small * TYPOGRAPHY.lineHeight.small,
      color: COLORS.primary.text,
      marginTop: 4,
      opacity: 0.8,
    };
  };

  const getErrorStyle = (): TextStyle => {
    return {
      fontSize: TYPOGRAPHY.small,
      lineHeight: TYPOGRAPHY.small * TYPOGRAPHY.lineHeight.small,
      color: COLORS.error.text,
      marginTop: 4,
      fontWeight: TYPOGRAPHY.fontWeight.medium,
    };
  };

  // Accessibility props
  const inputId = testID ? `${testID}-input` : `${label.toLowerCase().replace(/\s+/g, '-')}-input`;
  const labelId = testID ? `${testID}-label` : `${label.toLowerCase().replace(/\s+/g, '-')}-label`;
  const errorId = testID ? `${testID}-error` : `${label.toLowerCase().replace(/\s+/g, '-')}-error`;
  const helperId = testID ? `${testID}-helper` : `${label.toLowerCase().replace(/\s+/g, '-')}-helper`;

  const accessibilityLabel = `${label}${required ? ', required' : ''}${error ? ', has error' : ''}`;
  const accessibilityHint = error ? `Error: ${error}` : helperText;
  
  const accessibilityState: AccessibilityState = {
    disabled: textInputProps.editable === false,
  };

  const accessibilityLabelledBy = [labelId, error ? errorId : helperId].filter(Boolean).join(' ');

  return (
    <View style={[getContainerStyle(), containerStyle]}>
      <Text
        style={[getLabelStyle(), labelStyle]}
        nativeID={labelId}
        accessible={true}
        accessibilityRole="text"
      >
        {label}{required && ' *'}
      </Text>
      
      <TextInput
        ref={inputRef}
        style={[getInputStyle(), inputStyle]}
        value={value}
        onChangeText={onChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholderTextColor="#999999"
        accessible={true}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={accessibilityState}
        accessibilityLabelledBy={accessibilityLabelledBy}
        nativeID={inputId}
        testID={testID}
        {...textInputProps}
      />
      
      {error ? (
        <Text
          style={[getErrorStyle(), errorStyle]}
          nativeID={errorId}
          accessible={true}
          accessibilityRole="text"
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : helperText ? (
        <Text
          style={[getHelperTextStyle(), helperStyle]}
          nativeID={helperId}
          accessible={true}
          accessibilityRole="text"
        >
          {helperText}
        </Text>
      ) : null}
    </View>
  );
};

export default AccessibleFormField;