import { initializeApp } from 'firebase/app';
import { getDatabase, setLogLevel } from 'firebase/database';

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
const app = initializeApp(firebaseConfig);

// Export instance of Realtime Database
export const db = getDatabase(app);

// Enable detailed logging for debugging database operations.
// This will show the exact paths being written to in the browser console.
setLogLevel('debug');