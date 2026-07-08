/**
 * @fileOverview FitJourney local IndexedDB manager.
 * Stores meals, workouts, and timelapse photos locally in the user's browser database.
 * Bypasses the 5MB limit of localStorage, allowing binary images and unlimited logs.
 */

const DB_NAME = 'FitJourneyLocalDB';
const DB_VERSION = 1;

export interface MealEntry {
  id?: number;
  foodName: string;
  calories: number;
  timestamp: string;
  imageUrl?: string; // Stored as base64 data URL
  portionSize: 'small' | 'regular' | 'large';
  ingredientsBreakdown?: any[];
  dietaryClassification?: string[];
  healthSummary?: string;
  nutritionalScore?: number;
}

export interface WorkoutEntry {
  id?: number;
  type: string;
  duration: number; // in seconds or minutes
  caloriesBurned: number;
  timestamp: string;
  details?: any; // exercise specific metrics (reps, score, etc)
}

export interface PhotoEntry {
  id: string;
  date: string;
  url: string; // Base64 progress image URL
  scanResult?: any; // Body fat scan results
  notes?: string;
}

// Initialize database connection
export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('IndexedDB is only available in the browser'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      
      // Store for logged meals
      if (!db.objectStoreNames.contains('meals')) {
        db.createObjectStore('meals', { keyPath: 'id', autoIncrement: true });
      }
      
      // Store for recorded workouts/activities
      if (!db.objectStoreNames.contains('workouts')) {
        db.createObjectStore('workouts', { keyPath: 'id', autoIncrement: true });
      }
      
      // Store for body progress photos
      if (!db.objectStoreNames.contains('body_photos')) {
        db.createObjectStore('body_photos', { keyPath: 'id', autoIncrement: true });
      }
      
      // Store for face progress photos
      if (!db.objectStoreNames.contains('face_photos')) {
        db.createObjectStore('face_photos', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

// --- MEALS STORE OPERATIONS ---
export async function addMeal(meal: MealEntry): Promise<number> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meals', 'readwrite');
    const store = tx.objectStore('meals');
    const request = store.add(meal);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

export async function getMeals(): Promise<MealEntry[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meals', 'readonly');
    const store = tx.objectStore('meals');
    const request = store.getAll();
    request.onsuccess = () => {
      // Sort meals by timestamp descending (newest first)
      const meals = request.result as MealEntry[];
      meals.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      resolve(meals);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteMeal(id: number): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meals', 'readwrite');
    const store = tx.objectStore('meals');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// --- WORKOUTS STORE OPERATIONS ---
export async function addWorkout(workout: WorkoutEntry): Promise<number> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('workouts', 'readwrite');
    const store = tx.objectStore('workouts');
    const request = store.add(workout);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

export async function getWorkouts(): Promise<WorkoutEntry[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('workouts', 'readonly');
    const store = tx.objectStore('workouts');
    const request = store.getAll();
    request.onsuccess = () => {
      const workouts = request.result as WorkoutEntry[];
      workouts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      resolve(workouts);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteWorkout(id: number): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('workouts', 'readwrite');
    const store = tx.objectStore('workouts');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// --- BODY PHOTOS OPERATIONS ---
export async function addBodyPhoto(photo: PhotoEntry): Promise<number> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('body_photos', 'readwrite');
    const store = tx.objectStore('body_photos');
    const request = store.add(photo);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

export async function getBodyPhotos(): Promise<PhotoEntry[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('body_photos', 'readonly');
    const store = tx.objectStore('body_photos');
    const request = store.getAll();
    request.onsuccess = () => {
      const photos = request.result as PhotoEntry[];
      photos.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      resolve(photos);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteBodyPhoto(id: number): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('body_photos', 'readwrite');
    const store = tx.objectStore('body_photos');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// --- FACE PHOTOS OPERATIONS ---
export async function addFacePhoto(photo: PhotoEntry): Promise<number> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('face_photos', 'readwrite');
    const store = tx.objectStore('face_photos');
    const request = store.add(photo);
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

export async function getFacePhotos(): Promise<PhotoEntry[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('face_photos', 'readonly');
    const store = tx.objectStore('face_photos');
    const request = store.getAll();
    request.onsuccess = () => {
      const photos = request.result as PhotoEntry[];
      photos.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      resolve(photos);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteFacePhoto(id: number): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('face_photos', 'readwrite');
    const store = tx.objectStore('face_photos');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// --- BACKUP & RESTORE UTILITIES ---
export async function exportDatabaseBackup(): Promise<string> {
  const meals = await getMeals();
  const workouts = await getWorkouts();
  const bodyPhotos = await getBodyPhotos();
  const facePhotos = await getFacePhotos();
  
  const backupData = {
    version: DB_VERSION,
    timestamp: new Date().toISOString(),
    meals,
    workouts,
    bodyPhotos,
    facePhotos
  };
  
  return JSON.stringify(backupData);
}

export async function importDatabaseBackup(jsonString: string): Promise<void> {
  const backup = JSON.parse(jsonString);
  const db = await initDB();
  
  // Helper to import list of items into an object store
  const importStore = (storeName: string, items: any[]): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!items || !Array.isArray(items)) {
        resolve();
        return;
      }
      
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      
      // Clear store first to avoid duplicates
      store.clear();
      
      let count = 0;
      if (items.length === 0) {
        resolve();
        return;
      }
      
      for (const item of items) {
        // Strip the old autoincremented ID so it gets assigned a clean fresh key
        const { id, ...cleanItem } = item;
        const request = store.add(cleanItem);
        request.onsuccess = () => {
          count++;
          if (count === items.length) resolve();
        };
        request.onerror = () => reject(request.error);
      }
    });
  };
  
  await importStore('meals', backup.meals);
  await importStore('workouts', backup.workouts);
  await importStore('body_photos', backup.bodyPhotos);
  await importStore('face_photos', backup.facePhotos);
}
// End of database helper script. Triggering new deployment.
