// Firebase Configuration for RSVP Reader
// Using Firebase v9+ modular SDK via CDN compat mode

const firebaseConfig = {
    apiKey: "AIzaSyDTLYAEOBwcOavSRhsl9Vr7pxnHEMQ6dLo",
    authDomain: "rsvp-reader-d949e.firebaseapp.com",
    projectId: "rsvp-reader-d949e",
    storageBucket: "rsvp-reader-d949e.firebasestorage.app",
    messagingSenderId: "771803764344",
    appId: "1:771803764344:web:ee7c29d7c6bdd953143f8d",
    measurementId: "G-LB9Q9FYE49"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// ================================
// AUTH FUNCTIONS
// ================================

const firebaseAuth = {
    // Current user state
    currentUser: null,

    // Detect if running on mobile
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },

    // Sign in with Google - uses redirect on mobile, popup on desktop with fallback
    async signInWithGoogle() {
        try {
            if (this.isMobile()) {
                // Mobile: use redirect flow (more reliable on iOS Safari)
                await auth.signInWithRedirect(googleProvider);
                // After redirect, the page will reload and onAuthStateChanged will fire
                return null;
            } else {
                // Desktop: try popup first
                try {
                    const result = await auth.signInWithPopup(googleProvider);
                    return result.user;
                } catch (popupError) {
                    // If popup is blocked or fails, fall back to redirect
                    console.log('Popup failed, falling back to redirect:', popupError.code);
                    if (popupError.code === 'auth/popup-blocked' ||
                        popupError.code === 'auth/popup-closed-by-user' ||
                        popupError.code === 'auth/cancelled-popup-request') {
                        await auth.signInWithRedirect(googleProvider);
                        return null;
                    }
                    throw popupError;
                }
            }
        } catch (error) {
            console.error('Sign in error:', error);
            // Provide user-friendly error messages
            if (error.code === 'auth/unauthorized-domain') {
                throw new Error('This domain is not authorized for sign-in. Please contact the administrator.');
            } else if (error.code === 'auth/network-request-failed') {
                throw new Error('Network error. Please check your connection and try again.');
            }
            throw error;
        }
    },

    // Handle redirect result (called on page load)
    async handleRedirectResult() {
        try {
            const result = await auth.getRedirectResult();
            if (result && result.user) {
                console.log('Redirect sign-in successful:', result.user.displayName);
                return result.user;
            }
            return null;
        } catch (error) {
            console.error('Redirect result error:', error);
            // Don't throw - just log the error
            return null;
        }
    },

    // Sign out
    async signOut() {
        try {
            await auth.signOut();
        } catch (error) {
            console.error('Sign out error:', error);
            throw error;
        }
    },

    // Listen for auth state changes
    onAuthStateChanged(callback) {
        return auth.onAuthStateChanged((user) => {
            this.currentUser = user;
            callback(user);
        });
    },

    // Check if user is logged in
    isLoggedIn() {
        return this.currentUser !== null;
    }
};

// Handle redirect result on page load (important for mobile auth)
auth.getRedirectResult().then((result) => {
    if (result && result.user) {
        console.log('Redirect sign-in completed:', result.user.displayName);
    }
}).catch((error) => {
    // Common errors: popup closed, redirect cancelled, etc.
    if (error.code !== 'auth/redirect-cancelled-by-user') {
        console.error('Redirect auth error:', error);
    }
});

// ================================
// FIRESTORE FUNCTIONS
// ================================

const firestoreStorage = {
    // Get user's notes collection reference
    getNotesRef(userId) {
        return db.collection('users').doc(userId).collection('notes');
    },

    // Load all notes for user
    async loadNotes(userId) {
        try {
            const snapshot = await this.getNotesRef(userId)
                .orderBy('createdAt', 'desc')
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                // Convert Firestore timestamp to ISO string
                createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
            }));
        } catch (error) {
            console.error('Error loading notes:', error);
            return [];
        }
    },

    // Save a single note
    async saveNote(userId, note) {
        try {
            const noteData = {
                ...note,
                createdAt: note.createdAt || firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Use note.id as document ID if it exists, otherwise auto-generate
            if (note.id) {
                await this.getNotesRef(userId).doc(String(note.id)).set(noteData);
                return note.id;
            } else {
                const docRef = await this.getNotesRef(userId).add(noteData);
                return docRef.id;
            }
        } catch (error) {
            console.error('Error saving note:', error);
            throw error;
        }
    },

    // Delete a note
    async deleteNote(userId, noteId) {
        try {
            await this.getNotesRef(userId).doc(String(noteId)).delete();
        } catch (error) {
            console.error('Error deleting note:', error);
            throw error;
        }
    },

    // Sync all notes (used when migrating from localStorage)
    async syncNotes(userId, notes) {
        try {
            const batch = db.batch();

            for (const note of notes) {
                const noteRef = this.getNotesRef(userId).doc(String(note.id));
                batch.set(noteRef, {
                    ...note,
                    createdAt: note.createdAt || firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            await batch.commit();
            return true;
        } catch (error) {
            console.error('Error syncing notes:', error);
            return false;
        }
    }
};

// Export for use in main app
window.firebaseAuth = firebaseAuth;
window.firestoreStorage = firestoreStorage;
