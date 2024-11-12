// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getFirestore } from 'firebase/firestore';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: 'AIzaSyAw4KJ5k31nY4YIT49Ybf6YTYMIlw4wMlc',
    authDomain: 'card-confluence.firebaseapp.com',
    projectId: 'card-confluence',
    storageBucket: 'card-confluence.appspot.com',
    messagingSenderId: '1085717188985',
    appId: '1:1085717188985:web:6b12e923cf169519c79fa8',
    measurementId: 'G-C4NT3TS8BQ',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const firestore = getFirestore(app);
export { app, analytics, firestore };
