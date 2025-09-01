// Distance conversion utilities

/**
 * Convert distance between kilometers and miles
 */
export function convertDistance(distance: number, fromUnit: 'km' | 'mi', toUnit: 'km' | 'mi'): number {
  if (fromUnit === toUnit) {
    return distance;
  }
  
  if (fromUnit === 'km' && toUnit === 'mi') {
    return distance * 0.621371; // km to miles
  }
  
  if (fromUnit === 'mi' && toUnit === 'km') {
    return distance * 1.60934; // miles to km
  }
  
  return distance;
}

/**
 * Format distance with appropriate unit based on user settings
 */
export function formatDistance(distance: number, unit: 'km' | 'mi', precision: number = 2): string {
  if (typeof distance !== 'number' || isNaN(distance)) {
    return 'N/A';
  }
  
  return `${distance.toFixed(precision)} ${unit}`;
}

/**
 * Get display distance based on user's preferred unit
 */
export function getDisplayDistance(distance: number, sourceUnit: 'km' | 'mi', userUnit: 'km' | 'mi'): {
  value: number;
  formatted: string;
} {
  const convertedDistance = convertDistance(distance, sourceUnit, userUnit);
  
  return {
    value: convertedDistance,
    formatted: formatDistance(convertedDistance, userUnit)
  };
}

/**
 * Convert speed between km/h and mph
 */
export function convertSpeed(speed: number, fromUnit: 'km' | 'mi', toUnit: 'km' | 'mi'): number {
  if (fromUnit === toUnit) {
    return speed;
  }
  
  if (fromUnit === 'km' && toUnit === 'mi') {
    return speed * 0.621371; // km/h to mph
  }
  
  if (fromUnit === 'mi' && toUnit === 'km') {
    return speed * 1.60934; // mph to km/h
  }
  
  return speed;
}

/**
 * Format speed with appropriate unit
 */
export function formatSpeed(speed: number, unit: 'km' | 'mi', precision: number = 1): string {
  if (typeof speed !== 'number' || isNaN(speed)) {
    return 'N/A';
  }
  
  const unitLabel = unit === 'km' ? 'km/h' : 'mph';
  return `${speed.toFixed(precision)} ${unitLabel}`;
}

/**
 * Get display speed based on user's preferred unit
 */
export function getDisplaySpeed(speed: number, sourceUnit: 'km' | 'mi', userUnit: 'km' | 'mi'): {
  value: number;
  formatted: string;
} {
  const convertedSpeed = convertSpeed(speed, sourceUnit, userUnit);
  
  return {
    value: convertedSpeed,
    formatted: formatSpeed(convertedSpeed, userUnit)
  };
}