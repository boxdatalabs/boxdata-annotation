import { useState, useCallback } from "react";
import { BoundingBox, AnnotationClass, DEFAULT_CLASSES, CLASS_COLORS } from "@/types/annotation";

export const useAnnotations = () => {
  const [annotations, setAnnotations] = useState<BoundingBox[]>([]);
  const [classes, setClasses] = useState<AnnotationClass[]>(DEFAULT_CLASSES);
  const [selectedClassId, setSelectedClassId] = useState<number>(0);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);

  const addAnnotation = useCallback((box: Omit<BoundingBox, "id">) => {
    const newAnnotation: BoundingBox = {
      ...box,
      id: crypto.randomUUID(),
    };
    setAnnotations((prev) => [...prev, newAnnotation]);
    setSelectedAnnotationId(newAnnotation.id);
    return newAnnotation.id;
  }, []);

  const updateAnnotation = useCallback((id: string, updates: Partial<BoundingBox>) => {
    setAnnotations((prev) =>
      prev.map((ann) => (ann.id === id ? { ...ann, ...updates } : ann))
    );
  }, []);

  const deleteAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((ann) => ann.id !== id));
    if (selectedAnnotationId === id) {
      setSelectedAnnotationId(null);
    }
  }, [selectedAnnotationId]);

  const clearAnnotations = useCallback(() => {
    setAnnotations([]);
    setSelectedAnnotationId(null);
  }, []);

  const addClass = useCallback((name: string) => {
    const newId = classes.length;
    const colorIndex = newId % CLASS_COLORS.length;
    const newClass: AnnotationClass = {
      id: newId,
      name,
      color: CLASS_COLORS[colorIndex],
    };
    setClasses((prev) => [...prev, newClass]);
    return newId;
  }, [classes.length]);

  const deleteClass = useCallback((id: number) => {
    setClasses((prev) => prev.filter((c) => c.id !== id));
    // Update annotations that use this class to use class 0
    setAnnotations((prev) =>
      prev.map((ann) => (ann.classId === id ? { ...ann, classId: 0 } : ann))
    );
    if (selectedClassId === id) {
      setSelectedClassId(0);
    }
  }, [selectedClassId]);

  const exportToYOLO = useCallback(() => {
    return annotations
      .map((ann) => {
        return `${ann.classId} ${ann.x.toFixed(6)} ${ann.y.toFixed(6)} ${ann.width.toFixed(6)} ${ann.height.toFixed(6)}`;
      })
      .join("\n");
  }, [annotations]);

  const importFromYOLO = useCallback((content: string) => {
    const lines = content.trim().split("\n").filter(line => line.trim());
    const newAnnotations: BoundingBox[] = lines.map((line) => {
      const parts = line.trim().split(/\s+/);
      return {
        id: crypto.randomUUID(),
        classId: parseInt(parts[0], 10),
        x: parseFloat(parts[1]),
        y: parseFloat(parts[2]),
        width: parseFloat(parts[3]),
        height: parseFloat(parts[4]),
      };
    });
    setAnnotations(newAnnotations);
  }, []);

  return {
    annotations,
    classes,
    selectedClassId,
    selectedAnnotationId,
    setSelectedClassId,
    setSelectedAnnotationId,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    clearAnnotations,
    addClass,
    deleteClass,
    exportToYOLO,
    importFromYOLO,
  };
};
