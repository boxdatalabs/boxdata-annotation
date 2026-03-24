import { useState, useCallback } from "react";
import {
  BoundingBox,
  AnnotationClass,
  ImageData,
  ImageAnnotations,
  DEFAULT_CLASSES,
} from "@/types/annotation";

export const useTaskAnnotations = (_taskId: string) => {
  const [images, setImages] = useState<ImageData[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [imageAnnotations, setImageAnnotations] = useState<ImageAnnotations>({});
  const [classes, setClasses] = useState<AnnotationClass[]>([...DEFAULT_CLASSES]);
  const [selectedClassId, setSelectedClassId] = useState<number>(0);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);

  const currentImage = images[currentImageIndex] || null;
  const annotations = currentImage ? (imageAnnotations[currentImage.id] || []) : [];

  const addImages = useCallback((newImages: ImageData[]) => {
    setImages((prev) => {
      const existingIds = new Set(prev.map((img) => img.id));
      const unique = newImages.filter((img) => !existingIds.has(img.id));
      return [...prev, ...unique];
    });
  }, []);

  const removeImage = useCallback((imageId: string) => {
    setImages((prev) => {
      const index = prev.findIndex((img) => img.id === imageId);
      const img = prev.find((img) => img.id === imageId);
      if (img?.src.startsWith("blob:")) {
        URL.revokeObjectURL(img.src);
      }
      const newImages = prev.filter((img) => img.id !== imageId);
      if (newImages.length === 0) {
        setCurrentImageIndex(0);
      } else if (index <= currentImageIndex && currentImageIndex > 0) {
        setCurrentImageIndex(currentImageIndex - 1);
      }
      return newImages;
    });
    setImageAnnotations((prev) => {
      const { [imageId]: _, ...rest } = prev;
      return rest;
    });
  }, [currentImageIndex]);

  const addAnnotation = useCallback((box: Omit<BoundingBox, "id">) => {
    if (!currentImage) return "";
    const newAnnotation: BoundingBox = {
      ...box,
      id: crypto.randomUUID(),
    };
    setImageAnnotations((prev) => ({
      ...prev,
      [currentImage.id]: [...(prev[currentImage.id] || []), newAnnotation],
    }));
    setSelectedAnnotationId(newAnnotation.id);
    return newAnnotation.id;
  }, [currentImage]);

  const updateAnnotation = useCallback((id: string, updates: Partial<BoundingBox>) => {
    if (!currentImage) return;
    setImageAnnotations((prev) => ({
      ...prev,
      [currentImage.id]: (prev[currentImage.id] || []).map((ann) =>
        ann.id === id ? { ...ann, ...updates } : ann
      ),
    }));
  }, [currentImage]);

  const deleteAnnotation = useCallback((id: string) => {
    if (!currentImage) return;
    setImageAnnotations((prev) => ({
      ...prev,
      [currentImage.id]: (prev[currentImage.id] || []).filter((ann) => ann.id !== id),
    }));
    if (selectedAnnotationId === id) {
      setSelectedAnnotationId(null);
    }
  }, [currentImage, selectedAnnotationId]);

  const clearAnnotations = useCallback(() => {
    if (!currentImage) return;
    setImageAnnotations((prev) => ({ ...prev, [currentImage.id]: [] }));
    setSelectedAnnotationId(null);
  }, [currentImage]);

  const addClass = useCallback((name: string) => {
    const newId = classes.length > 0 ? Math.max(...classes.map(c => c.id)) + 1 : 0;
    const colorIndex = newId % 8;
    const newClass: AnnotationClass = {
      id: newId,
      name,
      color: `hsl(var(--class-${colorIndex + 1}))`,
    };
    setClasses((prev) => [...prev, newClass]);
    return newId;
  }, [classes]);

  const deleteClass = useCallback((id: number) => {
    setClasses((prev) => prev.filter((c) => c.id !== id));
    setImageAnnotations((prev) => {
      const updated: ImageAnnotations = {};
      for (const imgId in prev) {
        updated[imgId] = prev[imgId].map((ann) =>
          ann.classId === id ? { ...ann, classId: 0 } : ann
        );
      }
      return updated;
    });
    if (selectedClassId === id) {
      setSelectedClassId(0);
    }
  }, [selectedClassId]);

  const exportToYOLO = useCallback((imageId: string) => {
    const anns = imageAnnotations[imageId] || [];
    return anns
      .map((ann) => `${ann.classId} ${ann.x.toFixed(6)} ${ann.y.toFixed(6)} ${ann.width.toFixed(6)} ${ann.height.toFixed(6)}`)
      .join("\n");
  }, [imageAnnotations]);

  const importFromYOLO = useCallback((content: string) => {
    if (!currentImage) return;
    const lines = content.trim().split("\n").filter((line) => line.trim());
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
    setImageAnnotations((prev) => ({ ...prev, [currentImage.id]: newAnnotations }));
  }, [currentImage]);

  const getAnnotationCount = useCallback((imageId: string) => {
    return (imageAnnotations[imageId] || []).length;
  }, [imageAnnotations]);

  const getTotalAnnotations = useCallback(() => {
    return Object.values(imageAnnotations).reduce((sum, anns) => sum + anns.length, 0);
  }, [imageAnnotations]);

  const getAnnotatedImagesCount = useCallback(() => {
    return Object.entries(imageAnnotations).filter(([_, anns]) => anns.length > 0).length;
  }, [imageAnnotations]);

  const getImageBlob = useCallback(async (imageId: string): Promise<Blob | null> => {
    const img = images.find((i) => i.id === imageId);
    if (!img) return null;
    const response = await fetch(img.src);
    return response.blob();
  }, [images]);

  return {
    images,
    currentImage,
    currentImageIndex,
    annotations,
    imageAnnotations,
    classes,
    selectedClassId,
    selectedAnnotationId,
    loading: false,
    setCurrentImageIndex,
    setSelectedClassId,
    setSelectedAnnotationId,
    addImages,
    removeImage,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    clearAnnotations,
    addClass,
    deleteClass,
    exportToYOLO,
    importFromYOLO,
    getAnnotationCount,
    getTotalAnnotations,
    getAnnotatedImagesCount,
    getImageBlob,
  };
};
