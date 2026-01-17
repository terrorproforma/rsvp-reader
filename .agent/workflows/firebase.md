---
description: How to manage Firebase configuration and deploy Firestore rules via CLI
---

# Firebase CLI Workflow

This project uses Firebase for authentication and Firestore for data storage.

## Project Details
- **Project ID:** `rsvp-reader-d949e`
- **Console:** https://console.firebase.google.com/project/rsvp-reader-d949e/overview

## Key Files
- `firebase-config.js` - Client-side Firebase SDK configuration
- `firestore.rules` - Firestore security rules
- `firebase.json` - Firebase CLI configuration
- `.firebaserc` - Project reference

## Deploy Firestore Security Rules

// turbo
1. Edit `firestore.rules` with the desired security rules

// turbo
2. Deploy the rules:
```bash
firebase deploy --only firestore:rules
```

## Current Security Rules
The rules allow authenticated users to read/write only their own data:
```
match /users/{userId}/{document=**} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

## Authentication Setup
If you need to re-authenticate with Firebase CLI:
```bash
firebase login
```

## Common Commands

| Command | Description |
|---------|-------------|
| `firebase login` | Authenticate with Firebase |
| `firebase projects:list` | List available projects |
| `firebase deploy --only firestore:rules` | Deploy Firestore rules |
| `firebase deploy --only firestore:indexes` | Deploy Firestore indexes |
| `firebase use rsvp-reader-d949e` | Switch to this project |

## Adding Authorized Domains
For Google Sign-In to work on a domain, it must be added to Firebase Console:
1. Go to Firebase Console → Authentication → Settings → Authorized domains
2. Add the domain (e.g., `readsfast.vercel.app`)

## Firestore Data Structure
```
users/{userId}/
  └── notes/{noteId}
        ├── id: string
        ├── title: string
        ├── content: string
        ├── wordCount: number
        ├── createdAt: timestamp
        └── updatedAt: timestamp
```
