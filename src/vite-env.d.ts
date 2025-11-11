// Fix: "Cannot find type definition file for 'vite/client'".
// Switched from a triple-slash directive to an import statement to ensure
// TypeScript's module resolution finds the Vite client types.
import 'vite/client';

// Add a module declaration for 'exifr' which lacks its own TypeScript types.
// This prevents the TS2307 error and allows the module to be imported.
declare module 'exifr';
