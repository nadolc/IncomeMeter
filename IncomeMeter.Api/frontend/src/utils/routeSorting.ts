import type { Route } from '../types';

export type SortOption = 
  | 'newest' 
  | 'oldest' 
  | 'highestEarn' 
  | 'lowestEarn' 
  | 'statusAsc' 
  | 'statusDesc' 
  | 'workTypeAZ' 
  | 'workTypeZA';

export const sortRoutes = (routes: Route[], sortOption: SortOption): Route[] => {
  const sortedRoutes = [...routes]; // Create a copy to avoid mutating original array
  
  switch (sortOption) {
    case 'newest':
      return sortedRoutes.sort((a, b) => 
        new Date(b.scheduleStart).getTime() - new Date(a.scheduleStart).getTime()
      );
    
    case 'oldest':
      return sortedRoutes.sort((a, b) => 
        new Date(a.scheduleStart).getTime() - new Date(b.scheduleStart).getTime()
      );
    
    case 'highestEarn':
      return sortedRoutes.sort((a, b) => {
        const aEarn = a.totalIncome || a.estimatedIncome || 0;
        const bEarn = b.totalIncome || b.estimatedIncome || 0;
        return bEarn - aEarn;
      });
    
    case 'lowestEarn':
      return sortedRoutes.sort((a, b) => {
        const aEarn = a.totalIncome || a.estimatedIncome || 0;
        const bEarn = b.totalIncome || b.estimatedIncome || 0;
        return aEarn - bEarn;
      });
    
    case 'statusAsc':
      return sortedRoutes.sort((a, b) => {
        const statusOrder = ['scheduled', 'in_progress', 'completed', 'cancelled'];
        const aIndex = statusOrder.indexOf(a.status);
        const bIndex = statusOrder.indexOf(b.status);
        return aIndex - bIndex;
      });
    
    case 'statusDesc':
      return sortedRoutes.sort((a, b) => {
        const statusOrder = ['cancelled', 'completed', 'in_progress', 'scheduled'];
        const aIndex = statusOrder.indexOf(a.status);
        const bIndex = statusOrder.indexOf(b.status);
        return aIndex - bIndex;
      });
    
    case 'workTypeAZ':
      return sortedRoutes.sort((a, b) => {
        const aType = a.workType || '';
        const bType = b.workType || '';
        return aType.localeCompare(bType);
      });
    
    case 'workTypeZA':
      return sortedRoutes.sort((a, b) => {
        const aType = a.workType || '';
        const bType = b.workType || '';
        return bType.localeCompare(aType);
      });
    
    default:
      return sortedRoutes;
  }
};

export interface SortingOption {
  value: SortOption;
  label: string;
}

export const getSortingOptions = (t: (key: string) => string): SortingOption[] => [
  { value: 'newest', label: t('routes.filters.sorting.newest') },
  { value: 'oldest', label: t('routes.filters.sorting.oldest') },
  { value: 'highestEarn', label: t('routes.filters.sorting.highestEarn') },
  { value: 'lowestEarn', label: t('routes.filters.sorting.lowestEarn') },
  { value: 'statusAsc', label: t('routes.filters.sorting.statusAsc') },
  { value: 'statusDesc', label: t('routes.filters.sorting.statusDesc') },
  { value: 'workTypeAZ', label: t('routes.filters.sorting.workTypeAZ') },
  { value: 'workTypeZA', label: t('routes.filters.sorting.workTypeZA') }
];