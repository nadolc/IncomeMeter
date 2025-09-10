import { GestureResponderEvent, ViewStyle, TextStyle, AccessibilityState, AccessibilityRole } from 'react-native';

export interface AccessibleButtonProps {
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

export interface AccessibleFormFieldProps {
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

export interface AccessibleCardProps {
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

export interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  style?: ViewStyle;
  accessibilityLabel?: string;
  testID?: string;
}

export interface HeaderAction {
  label: string;
  onPress: (event: GestureResponderEvent) => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  testID?: string;
}

export interface ScreenHeaderProps {
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