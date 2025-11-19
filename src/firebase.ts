import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import * as firebaseAuth from 'firebase/auth';

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
// @ts-ignore
const app = initializeApp(firebaseConfig);

// Export instance of Realtime Database
export const db = getDatabase(app);

// Export instance of Storage
// Подключен внешний бакет Google Cloud Storage
export const storage = getStorage(app, "gs://shutter-rank-storage");

// Export instance of Auth
export const auth = firebaseAuth.getAuth(app);
export const signInAnonymously = firebaseAuth.signInAnonymously;
