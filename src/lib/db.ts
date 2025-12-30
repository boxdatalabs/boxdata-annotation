import { Task, StoredImage, StoredAnnotations, StoredClasses, BoundingBox, AnnotationClass, DEFAULT_CLASSES } from "@/types/annotation";

const DB_NAME = "yolo-annotator";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Tasks store
      if (!db.objectStoreNames.contains("tasks")) {
        const taskStore = db.createObjectStore("tasks", { keyPath: "id" });
        taskStore.createIndex("createdAt", "createdAt");
      }

      // Images store
      if (!db.objectStoreNames.contains("images")) {
        const imageStore = db.createObjectStore("images", { keyPath: "id" });
        imageStore.createIndex("taskId", "taskId");
      }

      // Annotations store
      if (!db.objectStoreNames.contains("annotations")) {
        const annotationStore = db.createObjectStore("annotations", { keyPath: "imageId" });
        annotationStore.createIndex("taskId", "taskId");
      }

      // Classes store
      if (!db.objectStoreNames.contains("classes")) {
        db.createObjectStore("classes", { keyPath: "taskId" });
      }
    };
  });

  return dbPromise;
}

// Task operations
export async function getAllTasks(): Promise<Task[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("tasks", "readonly");
    const store = transaction.objectStore("tasks");
    const request = store.getAll();
    request.onsuccess = () => {
      const tasks = request.result as Task[];
      tasks.sort((a, b) => b.createdAt - a.createdAt);
      resolve(tasks);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getTask(id: string): Promise<Task | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("tasks", "readonly");
    const store = transaction.objectStore("tasks");
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function createTask(name: string): Promise<Task> {
  const db = await openDB();
  const task: Task = {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["tasks", "classes"], "readwrite");
    const taskStore = transaction.objectStore("tasks");
    const classStore = transaction.objectStore("classes");

    taskStore.add(task);
    classStore.add({ taskId: task.id, classes: DEFAULT_CLASSES });

    transaction.oncomplete = () => resolve(task);
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<void> {
  const db = await openDB();
  const task = await getTask(id);
  if (!task) throw new Error("Task not found");

  return new Promise((resolve, reject) => {
    const transaction = db.transaction("tasks", "readwrite");
    const store = transaction.objectStore("tasks");
    store.put({ ...task, ...updates, updatedAt: Date.now() });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function deleteTask(id: string): Promise<void> {
  const db = await openDB();

  // Get all images for this task
  const images = await getTaskImages(id);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["tasks", "images", "annotations", "classes"], "readwrite");

    transaction.objectStore("tasks").delete(id);
    transaction.objectStore("classes").delete(id);

    const imageStore = transaction.objectStore("images");
    const annotationStore = transaction.objectStore("annotations");

    for (const img of images) {
      imageStore.delete(img.id);
      annotationStore.delete(img.id);
    }

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// Image operations
export async function getTaskImages(taskId: string): Promise<StoredImage[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("images", "readonly");
    const store = transaction.objectStore("images");
    const index = store.index("taskId");
    const request = index.getAll(taskId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function addImage(image: StoredImage): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["images", "tasks"], "readwrite");
    transaction.objectStore("images").put(image);
    
    // Update task timestamp
    const taskStore = transaction.objectStore("tasks");
    const taskReq = taskStore.get(image.taskId);
    taskReq.onsuccess = () => {
      if (taskReq.result) {
        taskStore.put({ ...taskReq.result, updatedAt: Date.now() });
      }
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function deleteImage(imageId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["images", "annotations"], "readwrite");
    transaction.objectStore("images").delete(imageId);
    transaction.objectStore("annotations").delete(imageId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// Annotation operations
export async function getImageAnnotations(imageId: string): Promise<BoundingBox[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("annotations", "readonly");
    const store = transaction.objectStore("annotations");
    const request = store.get(imageId);
    request.onsuccess = () => {
      const result = request.result as StoredAnnotations | undefined;
      resolve(result?.annotations || []);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getTaskAnnotations(taskId: string): Promise<Record<string, BoundingBox[]>> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("annotations", "readonly");
    const store = transaction.objectStore("annotations");
    const index = store.index("taskId");
    const request = index.getAll(taskId);
    request.onsuccess = () => {
      const results = request.result as StoredAnnotations[];
      const annotationsMap: Record<string, BoundingBox[]> = {};
      for (const item of results) {
        annotationsMap[item.imageId] = item.annotations;
      }
      resolve(annotationsMap);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveAnnotations(
  imageId: string,
  taskId: string,
  annotations: BoundingBox[]
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["annotations", "tasks"], "readwrite");
    transaction.objectStore("annotations").put({ imageId, taskId, annotations });
    
    // Update task timestamp
    const taskStore = transaction.objectStore("tasks");
    const taskReq = taskStore.get(taskId);
    taskReq.onsuccess = () => {
      if (taskReq.result) {
        taskStore.put({ ...taskReq.result, updatedAt: Date.now() });
      }
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// Class operations
export async function getTaskClasses(taskId: string): Promise<AnnotationClass[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("classes", "readonly");
    const store = transaction.objectStore("classes");
    const request = store.get(taskId);
    request.onsuccess = () => {
      const result = request.result as StoredClasses | undefined;
      resolve(result?.classes || DEFAULT_CLASSES);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveClasses(taskId: string, classes: AnnotationClass[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("classes", "readwrite");
    const store = transaction.objectStore("classes");
    store.put({ taskId, classes });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// Utility to get task image count
export async function getTaskImageCount(taskId: string): Promise<number> {
  const images = await getTaskImages(taskId);
  return images.length;
}

// Utility to get task annotation count
export async function getTaskAnnotationCount(taskId: string): Promise<number> {
  const annotations = await getTaskAnnotations(taskId);
  return Object.values(annotations).reduce((sum, anns) => sum + anns.length, 0);
}