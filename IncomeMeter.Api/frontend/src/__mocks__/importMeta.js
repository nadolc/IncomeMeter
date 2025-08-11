// Mock import.meta for Jest environment
global.importMeta = {
  env: {
    VITE_API_BASE_URL: undefined,
    VITE_API_URL: undefined,
    DEV: false,
    MODE: 'test',
    PROD: true
  },
  hot: undefined,
  glob: () => ({})
};

// Make import.meta available globally
Object.defineProperty(globalThis, 'import', {
  value: {
    meta: global.importMeta
  }
});