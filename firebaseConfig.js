// ---------------------------------------------------------------------
// Firebase configuration for Stockroom
// ---------------------------------------------------------------------
// 1. Go to https://console.firebase.google.com → create a project
//    (or reuse your existing asm-stor project).
// 2. In Project settings → General → Your apps, add a Web app and copy
//    the config object it gives you into firebaseConfig below.
// 3. In the left sidebar go to Build → Firestore Database → Create database.
//    Start in test mode while you're setting this up, then lock down
//    your security rules before sharing the password/URL widely
//    (see the note at the bottom of this file).
// 4. Set SHARED_PASSWORD to whatever passcode your team should use to
//    unlock the app. Everyone who has this password gets full access
//    to add/edit/delete everything — this is a simple shared gate, not
//    per-user accounts or real security.
// ---------------------------------------------------------------------

export const firebaseConfig = {
  apiKey: "AIzaSyD3vPIX0AuWMPwCFb0_kv3DE2FiPFy5kLg",
  authDomain: "asm-stor.firebaseapp.com",
  projectId: "asm-stor",
  storageBucket: "asm-stor.firebasestorage.app",
  messagingSenderId: "744509770013",
  appId: "1:744509770013:web:bce61f11e1f3f9c5feb9f4",
};

export const SHARED_PASSWORD = "changeme";

// ---------------------------------------------------------------------
// IMPORTANT — Firestore security rules
// ---------------------------------------------------------------------
// By default, Firestore "test mode" allows anyone on the internet to
// read/write your database once they know your project's config values
// (which are visible in this file, shipped to the browser — that's
// normal for Firebase, but it means the *password screen* in this app
// is your only real gate, not Firestore itself).
//
// Once you've confirmed everything works, go to Firestore Database →
// Rules and replace the test-mode rules with something like:
//
//   rules_version = '2';
//   service cloud.firestore {
//     match /databases/{database}/documents {
//       match /{document=**} {
//         allow read, write: if request.time < timestamp.date(2100, 1, 1);
//       }
//     }
//   }
//
// This still isn't per-user auth — for that you'd add Firebase
// Authentication (e.g. email/password or a magic link) and rules that
// check request.auth != null. Ask if you'd like that added later.
// ---------------------------------------------------------------------
