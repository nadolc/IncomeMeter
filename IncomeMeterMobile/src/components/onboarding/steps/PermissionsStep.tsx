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
import {
  PERMISSIONS,
  RESULTS,
  request,
  check,
  openSettings,
  Permission,
  PermissionStatus,
} from 'react-native-permissions';
import { COLORS, TYPOGRAPHY } from '../../../constants/config';
import { AccessibleButton, AccessibleCard } from '../../UI';

interface PermissionItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  required: boolean;
  status: 'not_requested' | 'granted' | 'denied' | 'checking';
  permission: Permission;
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
  const [permissions, setPermissions] = useState<PermissionItem[]>([
    {
      id: 'location',
      title: 'Location Access',
      description: 'Required for GPS route tracking and mileage calculation',
      icon: '📍',
      required: true,
      status: 'not_requested',
      permission: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
    },
    {
      id: 'location_background',
      title: 'Background Location',
      description: 'Allows tracking routes when the app is not active',
      icon: '🔄',
      required: false,
      status: 'not_requested',
      permission: PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION,
    },
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'Get alerts for route milestones and earning updates',
      icon: '🔔',
      required: false,
      status: 'not_requested',
      permission: PERMISSIONS.ANDROID.POST_NOTIFICATIONS,
    },
  ]);

  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    checkAllPermissions();

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        checkAllPermissions();
      }
      setAppState(nextAppState);
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [appState]);

  useEffect(() => {
    // Auto-proceed if required permissions are granted
    if (canProceed() && hasAttemptedPermissions()) {
      // Small delay to show the granted state before proceeding
      setTimeout(() => {
        onNext();
      }, 1000);
    }
  }, [permissions]);

  const checkAllPermissions = async () => {
    console.log('Checking all permissions...');

    for (const permission of permissions) {
      try {
        const status = await check(permission.permission);
        updatePermissionStatus(permission.id, mapPermissionStatus(status));
      } catch (error) {
        console.error(`Error checking permission ${permission.id}:`, error);
        updatePermissionStatus(permission.id, 'denied');
      }
    }
  };

  const mapPermissionStatus = (status: PermissionStatus): 'granted' | 'denied' | 'not_requested' => {
    switch (status) {
      case RESULTS.GRANTED:
        return 'granted';
      case RESULTS.DENIED:
      case RESULTS.BLOCKED:
        return 'denied';
      case RESULTS.UNAVAILABLE:
      case RESULTS.LIMITED:
        return 'denied';
      default:
        return 'not_requested';
    }
  };

  const updatePermissionStatus = (permissionId: string, status: 'granted' | 'denied' | 'checking' | 'not_requested') => {
    setPermissions(prev =>
      prev.map(p =>
        p.id === permissionId
          ? { ...p, status }
          : p
      )
    );
  };

  const requestPermission = async (permissionId: string) => {
    const permission = permissions.find(p => p.id === permissionId);
    if (!permission) return;

    updatePermissionStatus(permissionId, 'checking');

    try {
      const result = await request(permission.permission);
      const status = mapPermissionStatus(result);
      updatePermissionStatus(permissionId, status);

      if (status === 'denied' && permission.required) {
        showPermissionDeniedAlert(permission);
      }
    } catch (error) {
      console.error(`Error requesting permission ${permissionId}:`, error);
      updatePermissionStatus(permissionId, 'denied');

      if (permission.required) {
        showPermissionDeniedAlert(permission);
      }
    }
  };

  const showPermissionDeniedAlert = (permission: PermissionItem) => {
    Alert.alert(
      'Permission Required',
      `${permission.title} is required for IncomeMeter to function properly. Please grant this permission in your device settings.`,
      [
        {
          text: 'Continue Without',
          style: 'cancel',
          onPress: () => {
            // Allow continuing even without required permissions for testing
            if (permission.id === 'location') {
              Alert.alert(
                'Limited Functionality',
                'Without location permission, you will need to manually enter route information.',
                [{ text: 'OK' }]
              );
            }
          },
        },
        {
          text: 'Open Settings',
          onPress: () => openSettings(),
        },
      ]
    );
  };

  const getPermissionStatusColor = (status: PermissionItem['status']) => {
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

  const getPermissionStatusText = (status: PermissionItem['status']) => {
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
    // For testing purposes, allow proceeding even without all required permissions
    // In production, you might want to be more strict
    const requiredPermissions = permissions.filter(p => p.required);
    return requiredPermissions.length === 0 || requiredPermissions.some(p => p.status === 'granted' || p.status === 'denied');
  };

  const hasAttemptedPermissions = () => {
    return permissions.some(p => p.status !== 'not_requested');
  };

  const getAllGrantedPermissions = () => {
    return permissions.filter(p => p.status === 'granted');
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

  const getPermissionStatusStyle = (status: PermissionItem['status']): TextStyle => {
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

      {hasAttemptedPermissions() && (
        <AccessibleCard
          variant="filled"
          padding="medium"
          style={{
            marginTop: 16,
            backgroundColor: canProceed() ? COLORS.success.background : COLORS.warning.background
          }}
        >
          <Text
            style={{
              fontSize: TYPOGRAPHY.small,
              color: canProceed() ? COLORS.success.text : COLORS.warning.text,
              textAlign: 'center',
              fontWeight: TYPOGRAPHY.fontWeight.medium,
            }}
            accessible={true}
            accessibilityRole={canProceed() ? "text" : "alert"}
          >
            {canProceed()
              ? `Great! You've granted ${getAllGrantedPermissions().length} permission(s). The app will continue automatically.`
              : 'Some permissions are needed for full functionality, but you can continue with limited features.'
            }
          </Text>

          {!canProceed() && (
            <View style={{ marginTop: 12 }}>
              <AccessibleButton
                title="Continue Anyway"
                onPress={onNext}
                variant="secondary"
                size="small"
                accessibilityLabel="Continue without all permissions"
                testID="continue-without-permissions"
              />
            </View>
          )}
        </AccessibleCard>
      )}
    </View>
  );
};

export default PermissionsStep;