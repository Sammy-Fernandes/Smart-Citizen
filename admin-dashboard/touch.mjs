import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyC_J29mrAmjAFOoUos65aMnH3_itnRNOqE",
    authDomain: "civic-engagement-app-67289.firebaseapp.com",
    projectId: "civic-engagement-app-67289",
    storageBucket: "civic-engagement-app-67289.firebasestorage.app",
    messagingSenderId: "152362654985",
    appId: "1:152362654985:web:1a91295286475653b47f61",
    measurementId: "G-W13ESJ8CTN"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
    console.log("Fetching complaints...");
    const snapshot = await getDocs(collection(db, 'complaints'));
    console.log(`Found ${snapshot.docs.length} complaints.`);
    for (const d of snapshot.docs) {
        console.log(`Updating ${d.id}`);
        await updateDoc(doc(db, 'complaints', d.id), {
            updatedAt: serverTimestamp()
        });
    }
    console.log("Done!");
    process.exit(0);
}

run().catch(console.error);
