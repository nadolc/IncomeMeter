// Development helpers - only active in development mode

export function enableHotReload() {
  if (import.meta.env.DEV) {
    // Enable hot reload for new route additions
    if (import.meta.hot) {
      import.meta.hot.accept(() => {
        console.log('🔥 Hot reload triggered - new components detected');
      });
      
      // Listen for new route files
      import.meta.hot.on('vite:beforeUpdate', () => {
        console.log('🔄 Updating modules...');
      });
      
      import.meta.hot.on('vite:afterUpdate', () => {
        console.log('✅ Modules updated successfully');
      });
    }
  }
}

export function forceReload() {
  if (import.meta.env.DEV) {
    console.log('🔄 Force reloading page...');
    window.location.reload();
  }
}

// Auto-detect new routes and suggest reload
export function detectNewRoutes() {
  if (import.meta.env.DEV) {
    const routeModules = import.meta.glob('/src/components/Pages/*.tsx', { eager: false });
    const currentRoutes = Object.keys(routeModules);
    
    // Store route count in localStorage
    const storedCount = localStorage.getItem('dev-route-count');
    const currentCount = currentRoutes.length;
    
    if (storedCount && parseInt(storedCount) < currentCount) {
      console.log('🆕 New route detected! Consider refreshing the page.');
      
      // Optional: Auto-refresh after short delay
      if (confirm('New page components detected. Refresh to load them?')) {
        forceReload();
      }
    }
    
    localStorage.setItem('dev-route-count', currentCount.toString());
  }
}