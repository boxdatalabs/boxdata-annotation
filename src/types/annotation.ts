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
  src: string;
  name: string;
  width: number;
  height: number;
}

export interface DrawingState {
  isDrawing: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
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
