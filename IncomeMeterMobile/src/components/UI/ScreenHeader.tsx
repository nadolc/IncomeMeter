import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  GestureResponderEvent,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, TYPOGRAPHY } from '../../constants/config';

interface HeaderAction {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  testID?: string;
}

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  onBackPress?: (event: GestureResponderEvent) => void;
  actions?: HeaderAction[];
  backgroundColor?: string;
  titleColor?: string;
  subtitleColor?: string;
  statusBarStyle?: 'default' | 'light-content' | 'dark-content';
  style?: ViewStyle;
  titleStyle?: TextStyle;
  subtitleStyle?: TextStyle;
  testID?: string;
}

const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  showBackButton = false,
  onBackPress,
  actions = [],
  backgroundColor = COLORS.primary.background,
  titleColor = COLORS.primary.text,
  subtitleColor = COLORS.primary.text,
  statusBarStyle = 'dark-content',
  style,
  titleStyle,
  subtitleStyle,
  testID,
}) => {
  const insets = useSafeAreaInsets();

  const getHeaderStyle = (): ViewStyle => {
    return {
      backgroundColor,
      paddingTop: insets.top,
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#e0e0e0',
    };
  };

  const getContentStyle = (): ViewStyle => {
    return {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 56,
    };
  };

  const getTitleStyle = (): TextStyle => {
    return {
      fontSize: TYPOGRAPHY.heading,
      fontWeight: TYPOGRAPHY.fontWeight.semibold,
      color: titleColor,
      lineHeight: TYPOGRAPHY.heading * TYPOGRAPHY.lineHeight.body,
      flex: 1,
      textAlign: showBackButton ? 'left' : 'center',
      marginLeft: showBackButton ? 12 : 0,
      marginRight: actions.length > 0 ? 12 : 0,
    };
  };

  const getSubtitleStyle = (): TextStyle => {
    return {
      fontSize: TYPOGRAPHY.small,
      fontWeight: TYPOGRAPHY.fontWeight.regular,
      color: subtitleColor,
      opacity: 0.8,
      lineHeight: TYPOGRAPHY.small * TYPOGRAPHY.lineHeight.small,
      marginTop: 2,
    };
  };

  const BackButton = () => {
    if (!showBackButton) return null;

    return (
      <TouchableOpacity
        onPress={onBackPress}
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          justifyContent: 'center',
          alignItems: 'center',
        }}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        accessibilityHint="Navigate to the previous screen"
        testID={testID ? `${testID}-back-button` : 'header-back-button'}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={{ fontSize: 18, color: titleColor }}>←</Text>
      </TouchableOpacity>
    );
  };

  const Actions = () => {
    if (actions.length === 0) return null;

    return (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {actions.map((action, index) => (
          <TouchableOpacity
            key={index}
            onPress={action.disabled ? undefined : action.onPress}
            disabled={action.disabled}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              justifyContent: 'center',
              alignItems: 'center',
              marginLeft: index > 0 ? 8 : 0,
              opacity: action.disabled ? 0.6 : 1,
            }}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={action.accessibilityLabel || action.label}
            accessibilityHint={action.accessibilityHint}
            accessibilityState={{ disabled: action.disabled }}
            testID={action.testID || `header-action-${index}`}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {action.icon || (
              <Text style={{ fontSize: 16, color: titleColor }}>
                {action.label}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <View style={[getHeaderStyle(), style]} testID={testID}>
      <StatusBar
        barStyle={statusBarStyle}
        backgroundColor={backgroundColor}
        translucent={false}
      />
      
      <View style={getContentStyle()}>
        <BackButton />
        
        <View style={{ flex: 1 }}>
          <Text
            style={[getTitleStyle(), titleStyle]}
            numberOfLines={1}
            adjustsFontSizeToFit
            accessible={true}
            accessibilityRole="header"
            testID={testID ? `${testID}-title` : 'header-title'}
          >
            {title}
          </Text>
          
          {subtitle && (
            <Text
              style={[getSubtitleStyle(), subtitleStyle]}
              numberOfLines={1}
              adjustsFontSizeToFit
              accessible={true}
              accessibilityRole="text"
              testID={testID ? `${testID}-subtitle` : 'header-subtitle'}
            >
              {subtitle}
            </Text>
          )}
        </View>
        
        <Actions />
      </View>
    </View>
  );
};

export default ScreenHeader;