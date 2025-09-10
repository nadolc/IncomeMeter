import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Alert,
  Linking,
  AppState,
  AppStateStatus,
} from 'react-native';
import { COLORS, TYPOGRAPHY } from '../../../constants/config';
import { AccessibleButton, AccessibleCard } from '../../ui';

interface Permission {
  id: string;
  title: string;
  description: string;
  icon: string;
  required: boolean;
  status: 'not_requested' | 'granted' | 'denied' | 'checking';
  permission: string;
}

interface PermissionsStepProps {
  onNext: () => void;
  onSkip?: () => void;
  onComplete: () => void;
  currentStep: number;
  totalSteps: number;
}

const PermissionsStep: React.FC<PermissionsStepProps> = ({
  onNext,
  onSkip,
  onComplete,
  currentStep,
  totalSteps,
}) => {
  const [permissions, setPermissions] = useState<Permission[]>([
    {
      id: 'location',
      title: 'Location Access',
      description: 'Required for GPS route tracking and mileage calculation',
      icon: '📍',
      required: true,
      status: 'not_requested',
      permission: 'android.permission.ACCESS_FINE_LOCATION',
    },
    {
      id: 'location_background',
      title: 'Background Location',
      description: 'Allows tracking routes when the app is not active',
      icon: '🔄',
      required: false,
      status: 'not_requested',
      permission: 'android.permission.ACCESS_BACKGROUND_LOCATION',
    },
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'Get alerts for route milestones and earning updates',
      icon: '🔔',
      required: false,
      status: 'not_requested',
      permission: 'android.permission.POST_NOTIFICATIONS',
    },
  ]);

  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        checkAllPermissions();
      }
      setAppState(nextAppState);
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [appState]);

  const checkAllPermissions = async () => {
    // In a real implementation, this would use react-native-permissions
    // For now, we'll simulate permission checking
    console.log('Checking all permissions...');
  };

  const requestPermission = async (permissionId: string) => {
    setPermissions(prev => 
      prev.map(p => 
        p.id === permissionId 
          ? { ...p, status: 'checking' }
          : p
      )
    );

    // Simulate permission request
    setTimeout(() => {
      const permission = permissions.find(p => p.id === permissionId);
      if (permission) {
        // Simulate different outcomes based on permission type
        let status: 'granted' | 'denied';
        if (permissionId === 'location') {
          status = Math.random() > 0.2 ? 'granted' : 'denied';
        } else {
          status = Math.random() > 0.3 ? 'granted' : 'denied';
        }

        setPermissions(prev => 
          prev.map(p => 
            p.id === permissionId 
              ? { ...p, status }
              : p
          )
        );

        if (status === 'denied' && permission.required) {
          showPermissionDeniedAlert(permission);
        }
      }
    }, 1000);
  };

  const showPermissionDeniedAlert = (permission: Permission) => {
    Alert.alert(
      'Permission Required',
      `${permission.title} is required for IncomeMeter to function properly. Please grant this permission in your device settings.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Open Settings',
          onPress: () => Linking.openSettings(),
        },
      ]
    );
  };

  const getPermissionStatusColor = (status: Permission['status']) => {
    switch (status) {
      case 'granted':
        return COLORS.success.text;
      case 'denied':
        return COLORS.error.text;
      case 'checking':
        return COLORS.warning.text;
      default:
        return COLORS.primary.text;
    }
  };

  const getPermissionStatusText = (status: Permission['status']) => {
    switch (status) {
      case 'granted':
        return 'Granted ✓';
      case 'denied':
        return 'Denied ✗';
      case 'checking':
        return 'Checking...';
      default:
        return 'Not requested';
    }
  };

  const canProceed = () => {
    const requiredPermissions = permissions.filter(p => p.required);
    return requiredPermissions.every(p => p.status === 'granted');
  };

  const getContainerStyle = (): ViewStyle => {
    return {
      flex: 1,
      paddingVertical: 20,
    };
  };

  const getHeaderStyle = (): TextStyle => {
    return {
      fontSize: TYPOGRAPHY.large,
      fontWeight: TYPOGRAPHY.fontWeight.semibold,
      color: COLORS.primary.text,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: TYPOGRAPHY.large * TYPOGRAPHY.lineHeight.large,
    };
  };

  const getPermissionCardStyle = (): ViewStyle => {
    return {
      marginBottom: 16,
    };
  };

  const getPermissionContentStyle = (): ViewStyle => {
    return {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 16,
    };
  };

  const getPermissionIconStyle = (): TextStyle => {
    return {
      fontSize: 24,
      lineHeight: 30,
    };
  };

  const getPermissionTextContainerStyle = (): ViewStyle => {
    return {
      flex: 1,
    };
  };

  const getPermissionTitleStyle = (): TextStyle => {
    return {
      fontSize: TYPOGRAPHY.body,
      fontWeight: TYPOGRAPHY.fontWeight.semibold,
      color: COLORS.primary.text,
      marginBottom: 4,
    };
  };

  const getPermissionDescriptionStyle = (): TextStyle => {
    return {
      fontSize: TYPOGRAPHY.small,
      color: COLORS.primary.text,
      opacity: 0.8,
      lineHeight: TYPOGRAPHY.small * TYPOGRAPHY.lineHeight.small,
      marginBottom: 8,
    };
  };

  const getPermissionStatusStyle = (status: Permission['status']): TextStyle => {
    return {
      fontSize: TYPOGRAPHY.small,
      fontWeight: TYPOGRAPHY.fontWeight.medium,
      color: getPermissionStatusColor(status),
    };
  };

  const getPermissionActionsStyle = (): ViewStyle => {
    return {
      marginTop: 12,
      gap: 8,
    };
  };

  return (
    <View
      style={getContainerStyle()}
      accessible={false}
    >
      <Text
        style={getHeaderStyle()}
        accessible={true}
        accessibilityRole="header"
        accessibilityLevel={2}
      >
        Grant permissions to get the most out of IncomeMeter
      </Text>

      {permissions.map((permission) => (
        <AccessibleCard
          key={permission.id}
          variant="outlined"
          padding="medium"
          style={getPermissionCardStyle()}
          accessibilityLabel={`${permission.title} permission: ${permission.description}. Status: ${getPermissionStatusText(permission.status)}`}
          testID={`permission-card-${permission.id}`}
        >
          <View style={getPermissionContentStyle()}>
            <Text
              style={getPermissionIconStyle()}
              accessible={true}
              accessibilityRole="image"
              accessibilityLabel={`${permission.title} icon`}
            >
              {permission.icon}
            </Text>
            <View style={getPermissionTextContainerStyle()}>
              <Text style={getPermissionTitleStyle()}>
                {permission.title}
                {permission.required && (
                  <Text style={{ color: COLORS.error.text }}> *</Text>
                )}
              </Text>
              <Text style={getPermissionDescriptionStyle()}>
                {permission.description}
              </Text>
              <Text style={getPermissionStatusStyle(permission.status)}>
                {getPermissionStatusText(permission.status)}
              </Text>
              
              <View style={getPermissionActionsStyle()}>
                {permission.status === 'not_requested' && (
                  <AccessibleButton
                    title="Grant Permission"
                    onPress={() => requestPermission(permission.id)}
                    variant="primary"
                    size="small"
                    accessibilityLabel={`Grant ${permission.title} permission`}
                    testID={`grant-permission-${permission.id}`}
                  />
                )}
                {permission.status === 'denied' && (
                  <AccessibleButton
                    title="Open Settings"
                    onPress={() => Linking.openSettings()}
                    variant="secondary"
                    size="small"
                    accessibilityLabel={`Open device settings to grant ${permission.title} permission`}
                    testID={`open-settings-${permission.id}`}
                  />
                )}
              </View>
            </View>
          </View>
        </AccessibleCard>
      ))}

      {!canProceed() && (
        <AccessibleCard
          variant="filled"
          padding="medium"
          style={{ marginTop: 16, backgroundColor: COLORS.warning.background }}
        >
          <Text
            style={{
              fontSize: TYPOGRAPHY.small,
              color: COLORS.warning.text,
              textAlign: 'center',
              fontWeight: TYPOGRAPHY.fontWeight.medium,
            }}
            accessible={true}
            accessibilityRole="alert"
          >
            Location permission is required to track routes and calculate mileage.
          </Text>
        </AccessibleCard>
      )}
    </View>
  );
};

export default PermissionsStep;