# Accessibility-First Development Framework for IncomeMeter Mobile

## Overview
This framework ensures accessibility is built into every aspect of the IncomeMeter mobile application from the ground up, not retrofitted later. It provides guidelines, tools, and processes for creating an inclusive experience for users with diverse abilities and needs.

## Accessibility Principles

### 1. **Inclusive by Design**
- Consider accessibility from the initial design phase
- Design for diverse abilities, not just disabilities
- Create experiences that work for everyone

### 2. **Progressive Enhancement**
- Start with a solid, accessible foundation
- Layer enhancements that maintain accessibility
- Ensure core functionality works without advanced features

### 3. **User-Centered Approach**
- Involve users with disabilities in testing and feedback
- Prioritize real-world usage scenarios
- Validate assumptions with actual user research

### 4. **Standards Compliance**
- Meet WCAG 2.1 AA guidelines as minimum standard
- Follow platform-specific accessibility guidelines (iOS HIG, Android Material Design)
- Exceed standards where possible for better user experience

## WCAG 2.1 Implementation Framework

### Perceivable
Users must be able to perceive the information and user interface components.

#### Color and Contrast
```typescript
// Accessibility-first color system
const AccessibleColors = {
  // High contrast ratios (WCAG AA: 4.5:1, AAA: 7:1)
  primary: {
    background: '#FFFFFF',
    text: '#1a1a1a',        // 14.3:1 ratio
    contrast: '#000000'      // 21:1 ratio
  },
  
  success: {
    background: '#f0f9f0',
    text: '#1b5e20',        // 7.2:1 ratio
    border: '#4caf50'
  },
  
  error: {
    background: '#fdf2f2',
    text: '#c62828',        // 5.9:1 ratio
    border: '#f44336'
  },
  
  warning: {
    background: '#fffef0',
    text: '#e65100',        // 5.4:1 ratio
    border: '#ff9800'
  }
};

// Color contrast validation utility
const validateColorContrast = (foreground: string, background: string): boolean => {
  const ratio = calculateContrastRatio(foreground, background);
  return ratio >= 4.5; // WCAG AA standard
};
```

#### Typography and Text
```typescript
// Accessible typography system
const AccessibleTypography = {
  // Minimum font sizes for readability
  small: 14,    // Never go below 14pt for body text
  body: 16,     // Default body text size
  large: 18,    // Large text for better readability
  heading: 20,  // Minimum heading size
  
  // Line height for readability
  lineHeight: {
    small: 1.4,
    body: 1.5,
    large: 1.6
  },
  
  // Font weight for clarity
  fontWeight: {
    regular: '400',
    medium: '500',   // For emphasis without bold
    semibold: '600', // For headings
    bold: '700'      // For strong emphasis only
  }
};

// Dynamic text sizing support
const useDynamicTextSize = () => {
  const [textSizeMultiplier, setTextSizeMultiplier] = useState(1);
  
  useEffect(() => {
    // iOS: Text size multiplier
    if (Platform.OS === 'ios') {
      const listener = Text.addEventListener('textSizeMultiplierDidChange', 
        (event) => setTextSizeMultiplier(event.textSizeMultiplier)
      );
      return () => listener?.remove();
    }
    
    // Android: Font scale
    if (Platform.OS === 'android') {
      const fontScale = PixelRatio.getFontScale();
      setTextSizeMultiplier(fontScale);
    }
  }, []);
  
  return textSizeMultiplier;
};
```

#### Images and Media
```typescript
// Accessible image component
interface AccessibleImageProps {
  source: ImageSourcePropType;
  accessibilityLabel: string;
  accessibilityHint?: string;
  isDecorative?: boolean;
  testID?: string;
}

const AccessibleImage: React.FC<AccessibleImageProps> = ({
  source,
  accessibilityLabel,
  accessibilityHint,
  isDecorative = false,
  testID,
  ...props
}) => {
  return (
    <Image
      source={source}
      accessible={!isDecorative}
      accessibilityLabel={isDecorative ? undefined : accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole={isDecorative ? 'none' : 'image'}
      testID={testID}
      {...props}
    />
  );
};

// Usage examples
<AccessibleImage
  source={profilePicture}
  accessibilityLabel="User profile picture showing John Smith"
  accessibilityHint="Tap to view full profile"
/>

<AccessibleImage
  source={decorativePattern}
  accessibilityLabel=""
  isDecorative={true}
/>
```

### Operable
User interface components and navigation must be operable.

#### Touch Target Sizes
```typescript
// Accessibility-first touch target system
const TouchTargets = {
  // Minimum touch target sizes (44pt iOS, 48dp Android)
  minimum: 44,
  recommended: 48,
  large: 56,
  
  // Spacing between interactive elements
  spacing: {
    minimum: 8,
    recommended: 12,
    comfortable: 16
  }
};

// Accessible button component
interface AccessibleButtonProps {
  onPress: () => void;
  title: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  testID?: string;
}

const AccessibleButton: React.FC<AccessibleButtonProps> = ({
  onPress,
  title,
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
  size = 'medium',
  testID,
  children
}) => {
  const buttonSize = {
    small: TouchTargets.minimum,
    medium: TouchTargets.recommended,
    large: TouchTargets.large
  }[size];
  
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      testID={testID}
      style={[
        styles.button,
        {
          minHeight: buttonSize,
          minWidth: buttonSize,
          opacity: disabled ? 0.6 : 1
        }
      ]}
    >
      {children || <Text style={styles.buttonText}>{title}</Text>}
    </TouchableOpacity>
  );
};
```

#### Keyboard Navigation
```typescript
// Focus management system
const useFocusManagement = () => {
  const [currentFocusIndex, setCurrentFocusIndex] = useState(0);
  const focusableElements = useRef<Array<React.RefObject<any>>>([]);
  
  const addFocusableElement = (ref: React.RefObject<any>) => {
    if (!focusableElements.current.includes(ref)) {
      focusableElements.current.push(ref);
    }
  };
  
  const moveFocus = (direction: 'next' | 'previous') => {
    const elements = focusableElements.current.filter(ref => ref.current);
    if (elements.length === 0) return;
    
    let newIndex;
    if (direction === 'next') {
      newIndex = (currentFocusIndex + 1) % elements.length;
    } else {
      newIndex = currentFocusIndex === 0 ? elements.length - 1 : currentFocusIndex - 1;
    }
    
    setCurrentFocusIndex(newIndex);
    elements[newIndex].current?.focus();
  };
  
  return { addFocusableElement, moveFocus, currentFocusIndex };
};

// Accessible form component
const AccessibleForm: React.FC = ({ children }) => {
  const { addFocusableElement, moveFocus } = useFocusManagement();
  
  return (
    <View
      accessibilityRole="form"
      onKeyPress={(event) => {
        if (event.nativeEvent.key === 'Tab') {
          event.preventDefault();
          moveFocus(event.nativeEvent.shiftKey ? 'previous' : 'next');
        }
      }}
    >
      {children}
    </View>
  );
};
```

#### Gesture Alternatives
```typescript
// Gesture alternative system
interface GestureAlternativeProps {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  swipeLeftLabel?: string;
  swipeRightLabel?: string;
  showAlternativeButtons?: boolean;
}

const GestureAlternative: React.FC<GestureAlternativeProps> = ({
  onSwipeLeft,
  onSwipeRight,
  swipeLeftLabel,
  swipeRightLabel,
  showAlternativeButtons = true,
  children
}) => {
  return (
    <View>
      {/* Gesture-enabled content */}
      <PanGestureHandler onGestureEvent={handleGesture}>
        <View accessible={true}>
          {children}
        </View>
      </PanGestureHandler>
      
      {/* Alternative buttons for non-gesture users */}
      {showAlternativeButtons && (
        <View style={styles.alternativeButtons}>
          {onSwipeLeft && (
            <AccessibleButton
              onPress={onSwipeLeft}
              title={swipeLeftLabel || 'Previous'}
              accessibilityHint="Alternative to swiping left"
            />
          )}
          {onSwipeRight && (
            <AccessibleButton
              onPress={onSwipeRight}
              title={swipeRightLabel || 'Next'}
              accessibilityHint="Alternative to swiping right"
            />
          )}
        </View>
      )}
    </View>
  );
};
```

### Understandable
Information and the operation of user interface must be understandable.

#### Clear Language and Instructions
```typescript
// Accessible content guidelines
const AccessibleContent = {
  // Writing guidelines
  guidelines: {
    readingLevel: 'Grade 8 or lower',
    sentenceLength: 'Maximum 20 words',
    paragraphLength: 'Maximum 5 sentences',
    terminology: 'Consistent throughout app',
    instructions: 'Clear, actionable, sequential'
  },
  
  // Error message templates
  errorMessages: {
    required: (field: string) => `${field} is required. Please enter a value.`,
    invalid: (field: string, format: string) => 
      `${field} format is invalid. Please use ${format} format.`,
    network: 'Unable to connect. Please check your internet connection and try again.',
    server: 'Service is temporarily unavailable. Please try again in a few minutes.'
  },
  
  // Success message templates
  successMessages: {
    saved: 'Your changes have been saved successfully.',
    deleted: (item: string) => `${item} has been deleted successfully.`,
    completed: (action: string) => `${action} completed successfully.`
  }
};

// Accessible help system
interface AccessibleHelp {
  title: string;
  content: string;
  steps?: string[];
  relatedTopics?: string[];
}

const HelpProvider: React.FC = () => {
  const [helpContent, setHelpContent] = useState<AccessibleHelp | null>(null);
  
  const showHelp = (topic: string) => {
    const content = getHelpContent(topic);
    setHelpContent(content);
  };
  
  return (
    <Modal
      visible={helpContent !== null}
      onRequestClose={() => setHelpContent(null)}
      accessibilityViewIsModal={true}
    >
      {helpContent && (
        <ScrollView
          contentContainerStyle={styles.helpContainer}
          accessible={true}
          accessibilityRole="article"
        >
          <Text
            style={styles.helpTitle}
            accessibilityRole="header"
            accessibilityLevel={1}
          >
            {helpContent.title}
          </Text>
          
          <Text style={styles.helpContent}>
            {helpContent.content}
          </Text>
          
          {helpContent.steps && (
            <View>
              <Text
                style={styles.stepsTitle}
                accessibilityRole="header"
                accessibilityLevel={2}
              >
                Steps:
              </Text>
              {helpContent.steps.map((step, index) => (
                <Text key={index} style={styles.step}>
                  {index + 1}. {step}
                </Text>
              ))}
            </View>
          )}
          
          <AccessibleButton
            onPress={() => setHelpContent(null)}
            title="Close Help"
            accessibilityHint="Close help dialog and return to previous screen"
          />
        </ScrollView>
      )}
    </Modal>
  );
};
```

#### Form Validation and Error Handling
```typescript
// Accessible form validation
interface AccessibleFormFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  required?: boolean;
  helpText?: string;
  inputType?: 'text' | 'email' | 'number' | 'password';
  testID?: string;
}

const AccessibleFormField: React.FC<AccessibleFormFieldProps> = ({
  label,
  value,
  onChangeText,
  error,
  required = false,
  helpText,
  inputType = 'text',
  testID
}) => {
  const inputRef = useRef<TextInput>(null);
  const errorId = `${testID}_error`;
  const helpId = `${testID}_help`;
  
  return (
    <View style={styles.formField}>
      <Text
        style={[styles.label, required && styles.requiredLabel]}
        accessibilityRole="text"
        nativeID={`${testID}_label`}
      >
        {label}{required && ' *'}
      </Text>
      
      {helpText && (
        <Text
          style={styles.helpText}
          nativeID={helpId}
          accessibilityRole="text"
        >
          {helpText}
        </Text>
      )}
      
      <TextInput
        ref={inputRef}
        style={[styles.input, error && styles.inputError]}
        value={value}
        onChangeText={onChangeText}
        accessible={true}
        accessibilityLabel={label}
        accessibilityLabelledBy={`${testID}_label`}
        accessibilityDescribedBy={[helpText && helpId, error && errorId].filter(Boolean).join(' ')}
        accessibilityInvalid={!!error}
        keyboardType={getKeyboardType(inputType)}
        secureTextEntry={inputType === 'password'}
        textContentType={getTextContentType(inputType)}
        testID={testID}
      />
      
      {error && (
        <View
          style={styles.errorContainer}
          accessibilityRole="alert"
          nativeID={errorId}
        >
          <Icon name="error" color={AccessibleColors.error.text} />
          <Text style={styles.errorText}>
            {error}
          </Text>
        </View>
      )}
    </View>
  );
};
```

### Robust
Content must be robust enough that it can be interpreted reliably by a wide variety of user agents, including assistive technologies.

#### Screen Reader Support
```typescript
// Screen reader optimization
const ScreenReaderUtils = {
  // Announce important changes
  announceChange: (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(message);
    } else {
      AccessibilityInfo.setAccessibilityFocus(
        findNodeHandle(announcementRef.current)
      );
    }
  },
  
  // Check if screen reader is enabled
  isScreenReaderEnabled: async (): Promise<boolean> => {
    return await AccessibilityInfo.isScreenReaderEnabled();
  },
  
  // Optimize content for screen readers
  optimizeForScreenReader: (text: string): string => {
    return text
      .replace(/\$/g, 'dollars ')
      .replace(/&/g, ' and ')
      .replace(/\d+/g, (match) => `${match} `)
      .replace(/([A-Z])/g, ' $1')
      .toLowerCase()
      .trim();
  }
};

// Screen reader optimized route component
const AccessibleRouteItem: React.FC<{ route: Route }> = ({ route }) => {
  const screenReaderText = useMemo(() => {
    const duration = route.actualEndTime && route.actualStartTime
      ? formatDuration(route.actualEndTime.getTime() - route.actualStartTime.getTime())
      : 'Duration not available';
    
    const earnings = route.totalIncome > 0
      ? `Earned ${route.totalIncome} dollars`
      : 'No earnings recorded';
    
    const distance = route.distance > 0
      ? `Distance ${route.distance} miles`
      : 'Distance not available';
    
    return `Route for ${route.workType}. ${earnings}. ${distance}. ${duration}. Status: ${route.status}`;
  }, [route]);
  
  return (
    <TouchableOpacity
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={screenReaderText}
      accessibilityHint="Tap to view route details"
      onPress={() => navigateToRoute(route.id)}
      style={styles.routeItem}
    >
      <View importantForAccessibility="no-hide-descendants">
        <Text style={styles.workType}>{route.workType}</Text>
        <Text style={styles.earnings}>${route.totalIncome}</Text>
        <Text style={styles.distance}>{route.distance} mi</Text>
        <Text style={styles.status}>{route.status}</Text>
      </View>
    </TouchableOpacity>
  );
};
```

#### Platform-Specific Optimizations
```typescript
// iOS-specific accessibility optimizations
const IOSAccessibilityFeatures = {
  // Dynamic Type support
  supportsDynamicType: true,
  
  // VoiceOver custom actions
  addCustomActions: (element: any, actions: Array<{ name: string; action: () => void }>) => {
    if (Platform.OS === 'ios') {
      element.accessibilityActions = actions.map(action => ({
        name: action.name,
        label: action.name
      }));
      
      element.onAccessibilityAction = (event: any) => {
        const action = actions.find(a => a.name === event.nativeEvent.actionName);
        action?.action();
      };
    }
  },
  
  // Escape gestures for modal dialogs
  enableEscapeGesture: (onEscape: () => void) => {
    return {
      accessibilityViewIsModal: true,
      onAccessibilityEscape: onEscape
    };
  }
};

// Android-specific accessibility optimizations
const AndroidAccessibilityFeatures = {
  // TalkBack support
  supportsTalkBack: true,
  
  // Live regions for dynamic content
  setLiveRegion: (element: any, type: 'none' | 'polite' | 'assertive') => {
    if (Platform.OS === 'android') {
      element.accessibilityLiveRegion = type;
    }
  },
  
  // Switch Access support
  enableSwitchAccess: (element: any) => {
    if (Platform.OS === 'android') {
      element.focusable = true;
      element.accessible = true;
    }
  }
};
```

## Testing Framework

### Automated Accessibility Testing
```typescript
// Accessibility test utilities
const AccessibilityTesting = {
  // Color contrast testing
  testColorContrast: (component: ReactTestInstance) => {
    const styles = component.props.style;
    const backgroundColor = extractColor(styles, 'backgroundColor');
    const textColor = extractColor(styles, 'color');
    
    if (backgroundColor && textColor) {
      const ratio = calculateContrastRatio(textColor, backgroundColor);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  },
  
  // Touch target size testing
  testTouchTargetSize: (component: ReactTestInstance) => {
    const style = component.props.style;
    const height = style?.height || style?.minHeight;
    const width = style?.width || style?.minWidth;
    
    if (height) expect(height).toBeGreaterThanOrEqual(44);
    if (width) expect(width).toBeGreaterThanOrEqual(44);
  },
  
  // Screen reader content testing
  testScreenReaderContent: (component: ReactTestInstance) => {
    const { accessibilityLabel, accessibilityHint, accessibilityRole } = component.props;
    
    // Every interactive element should have proper labels
    if (isInteractiveElement(accessibilityRole)) {
      expect(accessibilityLabel).toBeTruthy();
      expect(accessibilityLabel.length).toBeGreaterThan(0);
    }
    
    // Labels should be descriptive
    if (accessibilityLabel) {
      expect(accessibilityLabel.length).toBeGreaterThan(3);
      expect(accessibilityLabel).not.toMatch(/^(button|link|image)$/i);
    }
  }
};

// Automated accessibility test suite
describe('Accessibility Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('should have proper color contrast ratios', () => {
    const { getAllByRole } = render(<RouteListScreen />);
    const buttons = getAllByRole('button');
    
    buttons.forEach(button => {
      AccessibilityTesting.testColorContrast(button);
    });
  });
  
  it('should have adequate touch target sizes', () => {
    const { getAllByRole } = render(<RouteListScreen />);
    const interactiveElements = [
      ...getAllByRole('button'),
      ...getAllByRole('link'),
      ...getAllByRole('tab')
    ];
    
    interactiveElements.forEach(element => {
      AccessibilityTesting.testTouchTargetSize(element);
    });
  });
  
  it('should have proper screen reader labels', () => {
    const { getAllByRole } = render(<RouteFormScreen />);
    const formElements = [
      ...getAllByRole('button'),
      ...getAllByRole('textbox'),
      ...getAllByRole('combobox')
    ];
    
    formElements.forEach(element => {
      AccessibilityTesting.testScreenReaderContent(element);
    });
  });
  
  it('should announce important state changes', async () => {
    const mockAnnounce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const { getByText } = render(<RouteTrackingScreen />);
    
    const startButton = getByText('Start Route');
    fireEvent.press(startButton);
    
    await waitFor(() => {
      expect(mockAnnounce).toHaveBeenCalledWith('Route tracking started');
    });
  });
});
```

### Manual Accessibility Testing Checklist

#### Screen Reader Testing
- [ ] **VoiceOver (iOS) / TalkBack (Android)**
  - All interactive elements are focusable
  - Focus order is logical and sequential
  - Labels are descriptive and unique
  - State changes are announced
  - Custom gestures have alternatives

#### Motor Accessibility Testing
- [ ] **Switch Control / Switch Access**
  - All functionality available via switch navigation
  - Scanning order is logical
  - No time-dependent interactions required

- [ ] **Voice Control**
  - All buttons have voice-friendly names
  - Text fields accept voice input
  - Navigation possible via voice commands

#### Visual Accessibility Testing
- [ ] **High Contrast Mode**
  - All content visible in high contrast
  - Color is not the only indicator of information
  - Focus indicators are clearly visible

- [ ] **Large Text / Dynamic Type**
  - Layout adapts to larger text sizes
  - No content is cut off or overlapping
  - Touch targets remain adequately sized

#### Cognitive Accessibility Testing
- [ ] **Consistent Navigation**
  - Navigation patterns are consistent
  - Similar functions behave the same way
  - Error recovery is straightforward

- [ ] **Clear Instructions**
  - All forms have clear labels and instructions
  - Error messages are descriptive and helpful
  - Success feedback is provided for actions

## Development Process Integration

### Pre-Development Phase
1. **Accessibility Requirements Gathering**
   - Include accessibility in user story acceptance criteria
   - Define accessibility personas and use cases
   - Set measurable accessibility goals

2. **Design Review**
   - Color contrast validation in design tools
   - Touch target size verification
   - Information hierarchy assessment

### During Development Phase
1. **Code Review Checklist**
   - Accessibility labels and hints present
   - Touch targets meet minimum size requirements
   - Color contrast meets WCAG standards
   - Keyboard navigation support implemented

2. **Feature Testing**
   - Test with screen reader enabled
   - Verify with different text sizes
   - Check focus management and navigation

### Post-Development Phase
1. **Quality Assurance**
   - Run automated accessibility tests
   - Perform manual screen reader testing
   - Validate with accessibility tools

2. **User Testing**
   - Include users with disabilities in testing
   - Gather feedback on accessibility features
   - Iterate based on real-world usage

## Continuous Improvement

### Metrics and Monitoring
```typescript
// Accessibility analytics
const AccessibilityAnalytics = {
  // Track accessibility feature usage
  trackAccessibilityFeature: (feature: string, enabled: boolean) => {
    analytics.track('accessibility_feature_usage', {
      feature,
      enabled,
      platform: Platform.OS,
      timestamp: Date.now()
    });
  },
  
  // Monitor screen reader usage
  trackScreenReaderUsage: async () => {
    const isEnabled = await AccessibilityInfo.isScreenReaderEnabled();
    analytics.track('screen_reader_usage', {
      enabled: isEnabled,
      platform: Platform.OS
    });
  },
  
  // Track accessibility errors
  trackAccessibilityError: (error: string, context: string) => {
    analytics.track('accessibility_error', {
      error,
      context,
      platform: Platform.OS,
      timestamp: Date.now()
    });
  }
};

// User feedback collection
const AccessibilityFeedback = {
  collectFeedback: () => ({
    screenReaderExperience: 'How was your experience using a screen reader?',
    navigationEase: 'How easy was it to navigate through the app?',
    contentClarity: 'Was the content clear and easy to understand?',
    suggestions: 'What improvements would help you use this app better?'
  }),
  
  processFeedback: (feedback: AccessibilityFeedback) => {
    // Analyze feedback for common accessibility issues
    // Prioritize improvements based on user impact
    // Track improvements over time
  }
};
```

### Regular Audits
- **Monthly**: Automated accessibility test runs
- **Quarterly**: Manual accessibility audits
- **Bi-annually**: External accessibility assessment
- **Annually**: Comprehensive accessibility review and strategy update

This accessibility-first framework ensures that the IncomeMeter mobile application is inclusive, usable, and compliant with accessibility standards from day one, creating a better experience for all users regardless of their abilities.