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