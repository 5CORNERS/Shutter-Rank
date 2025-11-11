// FIX: The import from 'firebase/app' was causing a module resolution error.
// Switched to 'firebase/compat/app' which is more stable across different bundler setups.
// The app instance created by the compat `initializeApp` is compatible with v9 modular functions like `getDatabase`,
// allowing for a targeted fix without refactoring the entire application.
import { initializeApp } from 'firebase/compat/app';
import { getDatabase } from 'firebase/database';

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCftktzmZr3d22oOcpCOtXDYxqRLLbiNmo",
    authDomain: "photo-voting-930f3.firebaseapp.com",
    databaseURL: "https://photo-voting-930f3-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "photo-voting-930f3",
    storageBucket: "photo-voting-930f3.appspot.com",
    messagingSenderId: "342161351813",
    appId: "1:342161351813:web:44a52680e36c4bc17735ec",
    measurementId: "G-Q9B9CYFJMR"
};


// Initialize Firebase
// FIX: Correctly call `initializeApp` as a direct function import to resolve "Property 'initializeApp' does not exist on type".
const app = initializeApp(firebaseConfig);

// Export instance of Realtime Database
export const db = getDatabase(app);