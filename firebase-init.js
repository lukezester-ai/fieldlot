import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, getDocs, query, orderBy, limit, where, doc, getDoc } from "firebase/firestore";
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
    const q = query(
      collection(db, "listings"),
      where("moderationStatus", "==", "approved"),
      orderBy("createdAt", "desc"),
      limit(limitCount),
    );
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
      const d = doc.data();
      fbData.push({
        id: doc.id,
        title: d.title,
        subtitle: d.location,
        category: d.category,
        price: d.price ? String(d.price) : "по дог.",
        priceUnit: "лв",
        qty: d.qty ? String(d.qty) : "",
        role: "sell",
        publishedAt: d.createdAt && typeof d.createdAt.toDate === 'function' ? d.createdAt.toDate().toISOString() : (d.createdAt ? new Date(d.createdAt).toISOString() : new Date().toISOString()),
        contact: "Fieldlot продавач",
        tags: d.category ? [d.category] : [],
        isFirebase: true,
        userId: d.userId,
        moderationStatus: d.moderationStatus || "approved",
        desc: d.desc || "",
        imageUrl: d.imageUrl || "",
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
    const userDoc = await getDoc(doc(db, "publicProfiles", userId));
    if (userDoc.exists()) {
      return userDoc.data();
    }
  } catch (e) {
    console.error("Error fetching public profile:", e);
  }
  return null;
};

window.fetchFirebaseLogistics = async function(limitCount = 40) {
  const rows = [];
  try {
    const q = query(collection(db, "logistics"), orderBy("createdAt", "desc"), limit(limitCount));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((docSnap) => {
      const d = docSnap.data();
      rows.push({
        id: docSnap.id,
        title: d.title,
        category: d.category || "transport",
        qty: d.qty ? String(d.qty) : "",
        unit: d.unit || "",
        price: d.price || "По договаряне",
        region: d.region || "",
        role: d.role === "buy" ? "buy" : "sell",
        sourceName: d.companyName || "Fieldlot",
        publishedAt: d.createdAt && typeof d.createdAt.toDate === "function" ? d.createdAt.toDate().toISOString() : new Date().toISOString(),
        img: d.imageUrl || null,
        desc: d.desc || "",
        isFirebase: true,
        userId: d.userId,
        demo: false,
      });
    });
  } catch (e) {
    console.error("Firebase logistics fetch error:", e);
  }
  return rows;
};

console.log("Firebase initialized successfully!");
