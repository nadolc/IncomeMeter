import React, { useRef, useEffect } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  ViewStyle,
  AccessibilityInfo,
} from 'react-native';
import { COLORS } from '../../constants/config';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  style?: ViewStyle;
  accessibilityLabel?: string;
  testID?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  color = COLORS.primary.contrast,
  style,
  accessibilityLabel = 'Loading',
  testID,
}) => {
  const spinValue = useRef(new Animated.Value(0)).current;

  const getSizeValue = () => {
    const sizes = {
      small: 20,
      medium: 32,
      large: 48,
    };
    return sizes[size];
  };

  const sizeValue = getSizeValue();
  const strokeWidth = Math.max(2, sizeValue / 8);

  useEffect(() => {
    const spin = () => {
      spinValue.setValue(0);
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }).start(() => spin());
    };

    spin();
  }, [spinValue]);

  const rotation = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  useEffect(() => {
    // Announce to screen readers that content is loading
    AccessibilityInfo.announceForAccessibility(accessibilityLabel);
  }, [accessibilityLabel]);

  return (
    <View
      style={[
        {
          width: sizeValue,
          height: sizeValue,
          justifyContent: 'center',
          alignItems: 'center',
        },
        style,
      ]}
      accessible={true}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      <Animated.View
        style={[
          {
            width: sizeValue,
            height: sizeValue,
            borderRadius: sizeValue / 2,
            borderWidth: strokeWidth,
            borderColor: 'transparent',
            borderTopColor: color,
            transform: [{ rotate: rotation }],
          },
        ]}
      />
    </View>
  );
};

export default LoadingSpinner;