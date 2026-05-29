import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, getDocs, query, orderBy, limit, doc, getDoc } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

window.fetchFirebaseListings = async function(limitCount = 20) {
  const fbData = [];
  try {
    const q = query(collection(db, "listings"), orderBy("createdAt", "desc"), limit(limitCount));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
      const d = doc.data();
      fbData.push({
        id: doc.id,
        title: d.title,
        subtitle: d.location, // maps to location
        category: d.category,
        price: d.price ? String(d.price) : "по дог.",
        priceUnit: "лв",
        qty: d.qty ? String(d.qty) : "",
        role: "sell",
        publishedAt: d.createdAt ? new Date(d.createdAt).toISOString() : new Date().toISOString(),
        contact: d.userEmail || "Фермер",
        tags: d.category ? [d.category] : [],
        isFirebase: true,
        userId: d.userId
      });
    });
  } catch (e) {
    console.error("Firebase listings fetch error:", e);
  }
  return fbData;
};

window.fetchUserProfile = async function(userId) {
  if (!userId) return null;
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (userDoc.exists()) {
      return userDoc.data();
    }
  } catch (e) {
    console.error("Error fetching user profile:", e);
  }
  return null;
};

console.log("Firebase initialized successfully!");
