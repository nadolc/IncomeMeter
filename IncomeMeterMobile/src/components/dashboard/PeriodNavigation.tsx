import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { PeriodType } from '../../types/dashboard';

interface PeriodNavigationProps {
  period: PeriodType;
  currentPeriodDisplay: string;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  style?: any;
}

const PeriodNavigation: React.FC<PeriodNavigationProps> = ({
  period,
  currentPeriodDisplay,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext,
  onToday,
  style,
}) => {
  const [swiping, setSwiping] = useState(false);

  const getPeriodName = (): string => {
    switch (period) {
      case 'weekly': return 'Week';
      case 'monthly': return 'Month';
      case 'annual': return 'Year';
      default: return period;
    }
  };

  // Create PanResponder for swipe gestures
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      // Only start responding if horizontal swipe is detected
      return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10;
    },
    onPanResponderGrant: () => {
      setSwiping(true);
    },
    onPanResponderMove: (evt, gestureState) => {
      // Optional: Add visual feedback during swipe
    },
    onPanResponderRelease: (evt, gestureState) => {
      setSwiping(false);

      // Detect swipe direction based on distance and velocity
      const { dx, vx } = gestureState;
      const swipeThreshold = 50;
      const velocityThreshold = 0.5;

      if (Math.abs(dx) > swipeThreshold || Math.abs(vx) > velocityThreshold) {
        if (dx > 0 && canGoPrevious) {
          // Swipe right - go to previous period
          onPrevious();
        } else if (dx < 0 && canGoNext) {
          // Swipe left - go to next period
          onNext();
        }
      }
    },
    onPanResponderTerminate: () => {
      setSwiping(false);
    },
  });

  return (
    <View
      style={[styles.container, swiping && styles.containerSwiping, style]}
      {...panResponder.panHandlers}
    >
      {/* Previous Button */}
      <TouchableOpacity
        onPress={onPrevious}
        disabled={!canGoPrevious}
        style={[
          styles.navButton,
          !canGoPrevious && styles.navButtonDisabled,
        ]}
        activeOpacity={0.7}
      >
        <Icon
          name="chevron-left"
          size={24}
          color={canGoPrevious ? '#374151' : '#D1D5DB'}
        />
      </TouchableOpacity>

      {/* Current Period Display */}
      <View style={styles.centerContainer}>
        <Text style={styles.periodTitle}>{currentPeriodDisplay}</Text>
        <Text style={styles.periodSubtitle}>{getPeriodName()}</Text>

        {/* Today Button */}
        <TouchableOpacity
          onPress={onToday}
          style={styles.todayButton}
          activeOpacity={0.7}
        >
          <Icon name="today" size={16} color="#3B82F6" />
          <Text style={styles.todayText}>Today</Text>
        </TouchableOpacity>
      </View>

      {/* Next Button */}
      <TouchableOpacity
        onPress={onNext}
        disabled={!canGoNext}
        style={[
          styles.navButton,
          !canGoNext && styles.navButtonDisabled,
        ]}
        activeOpacity={0.7}
      >
        <Icon
          name="chevron-right"
          size={24}
          color={canGoNext ? '#374151' : '#D1D5DB'}
        />
      </TouchableOpacity>

      {/* Swipe Indicator */}
      <View style={styles.swipeIndicator}>
        <View style={styles.swipeDot} />
        <View style={styles.swipeDot} />
        <View style={styles.swipeDot} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  containerSwiping: {
    backgroundColor: '#F8FAFC',
    transform: [{ scale: 0.98 }],
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  navButtonDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  periodTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  periodSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  todayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF8FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  todayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
    marginLeft: 4,
  },
  swipeIndicator: {
    position: 'absolute',
    bottom: 4,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
  },
  swipeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginHorizontal: 2,
  },
});

export default PeriodNavigation;