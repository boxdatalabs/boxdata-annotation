export interface BoundingBox {
  id: string;
  classId: number;
  x: number; // normalized x center (0-1)
  y: number; // normalized y center (0-1)
  width: number; // normalized width (0-1)
  height: number; // normalized height (0-1)
}

export interface AnnotationClass {
  id: number;
  name: string;
  color: string;
}

export interface ImageData {
  id: string;
  src: string;
  name: string;
  width: number;
  height: number;
  file?: File;
}

export interface ImageAnnotations {
  [imageId: string]: BoundingBox[];
}

export interface DrawingState {
  isDrawing: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

// Project types
export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

// Task types for persistent storage
export type TaskType = "image" | "speech-to-text";

export interface Task {
  id: string;
  projectId: string;
  name: string;
  type: TaskType;
  createdAt: number;
  updatedAt: number;
}

export interface VideoSegment {
  id: string;
  startTime: number; // seconds
  endTime: number; // seconds
  label: string;
}

export interface StoredImage {
  id: string;
  taskId: string;
  name: string;
  width: number;
  height: number;
  blob: Blob;
}

export interface StoredAnnotations {
  imageId: string;
  taskId: string;
  annotations: BoundingBox[];
}

export interface StoredClasses {
  taskId: string;
  classes: AnnotationClass[];
}

export const DEFAULT_CLASSES: AnnotationClass[] = [
  { id: 0, name: "person", color: "hsl(var(--class-1))" },
  { id: 1, name: "car", color: "hsl(var(--class-2))" },
  { id: 2, name: "dog", color: "hsl(var(--class-3))" },
  { id: 3, name: "cat", color: "hsl(var(--class-4))" },
];

export const CLASS_COLORS = [
  "hsl(var(--class-1))",
  "hsl(var(--class-2))",
  "hsl(var(--class-3))",
  "hsl(var(--class-4))",
  "hsl(var(--class-5))",
  "hsl(var(--class-6))",
  "hsl(var(--class-7))",
  "hsl(var(--class-8))",
];