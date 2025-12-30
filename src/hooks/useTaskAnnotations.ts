import { useState, useCallback, useEffect, useRef } from "react";
import {
  BoundingBox,
  AnnotationClass,
  ImageData,
  ImageAnnotations,
  StoredImage,
} from "@/types/annotation";
import {
  getTaskImages,
  getTaskAnnotations,
  getTaskClasses,
  addImage,
  deleteImage,
  saveAnnotations,
  saveClasses,
} from "@/lib/db";

export const useTaskAnnotations = (taskId: string) => {
  const [images, setImages] = useState<ImageData[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [imageAnnotations, setImageAnnotations] = useState<ImageAnnotations>({});
  const [classes, setClasses] = useState<AnnotationClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number>(0);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingAnnotationSaves = useRef<Set<string>>(new Set());

  const currentImage = images[currentImageIndex] || null;
  const annotations = currentImage ? (imageAnnotations[currentImage.id] || []) : [];

  // Load task data on mount
  useEffect(() => {
    const loadTaskData = async () => {
      setLoading(true);
      try {
        const [storedImages, storedAnnotations, storedClasses] = await Promise.all([
          getTaskImages(taskId),
          getTaskAnnotations(taskId),
          getTaskClasses(taskId),
        ]);

        // Convert stored images to ImageData with blob URLs
        const imageDataList: ImageData[] = storedImages.map((img) => ({
          id: img.id,
          name: img.name,
          width: img.width,
          height: img.height,
          src: URL.createObjectURL(img.blob),
        }));

        setImages(imageDataList);
        setImageAnnotations(storedAnnotations);
        setClasses(storedClasses);
      } catch (error) {
        console.error("Failed to load task data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadTaskData();

    // Cleanup blob URLs on unmount
    return () => {
      images.forEach((img) => {
        if (img.src.startsWith("blob:")) {
          URL.revokeObjectURL(img.src);
        }
      });
    };
  }, [taskId]);

  // Debounced save for annotations
  const scheduleSave = useCallback((imageId: string) => {
    pendingAnnotationSaves.current.add(imageId);
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      const toSave = Array.from(pendingAnnotationSaves.current);
      pendingAnnotationSaves.current.clear();
      
      for (const imgId of toSave) {
        const anns = imageAnnotations[imgId] || [];
        await saveAnnotations(imgId, taskId, anns);
      }
    }, 500);
  }, [taskId, imageAnnotations]);

  const addImages = useCallback(async (newImages: ImageData[]) => {
    const existingIds = new Set(images.map((img) => img.id));
    const uniqueImages = newImages.filter((img) => !existingIds.has(img.id));

    for (const img of uniqueImages) {
      if (img.file) {
        const storedImage: StoredImage = {
          id: img.id,
          taskId,
          name: img.name,
          width: img.width,
          height: img.height,
          blob: img.file,
        };
        await addImage(storedImage);
      }
    }

    setImages((prev) => [...prev, ...uniqueImages]);
  }, [images, taskId]);

  const removeImage = useCallback(async (imageId: string) => {
    await deleteImage(imageId);
    
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
    
    setImageAnnotations((prev) => {
      const updated = {
        ...prev,
        [currentImage.id]: [...(prev[currentImage.id] || []), newAnnotation],
      };
      // Schedule save after state update
      setTimeout(() => scheduleSave(currentImage.id), 0);
      return updated;
    });
    
    setSelectedAnnotationId(newAnnotation.id);
    return newAnnotation.id;
  }, [currentImage, scheduleSave]);

  const updateAnnotation = useCallback((id: string, updates: Partial<BoundingBox>) => {
    if (!currentImage) return;
    
    setImageAnnotations((prev) => {
      const updated = {
        ...prev,
        [currentImage.id]: (prev[currentImage.id] || []).map((ann) =>
          ann.id === id ? { ...ann, ...updates } : ann
        ),
      };
      setTimeout(() => scheduleSave(currentImage.id), 0);
      return updated;
    });
  }, [currentImage, scheduleSave]);

  const deleteAnnotation = useCallback((id: string) => {
    if (!currentImage) return;
    
    setImageAnnotations((prev) => {
      const updated = {
        ...prev,
        [currentImage.id]: (prev[currentImage.id] || []).filter((ann) => ann.id !== id),
      };
      setTimeout(() => scheduleSave(currentImage.id), 0);
      return updated;
    });
    
    if (selectedAnnotationId === id) {
      setSelectedAnnotationId(null);
    }
  }, [currentImage, selectedAnnotationId, scheduleSave]);

  const clearAnnotations = useCallback(() => {
    if (!currentImage) return;
    
    setImageAnnotations((prev) => {
      const updated = { ...prev, [currentImage.id]: [] };
      setTimeout(() => scheduleSave(currentImage.id), 0);
      return updated;
    });
    setSelectedAnnotationId(null);
  }, [currentImage, scheduleSave]);

  const addClass = useCallback(async (name: string) => {
    const newId = classes.length;
    const colorIndex = newId % 8;
    const newClass: AnnotationClass = {
      id: newId,
      name,
      color: `hsl(var(--class-${colorIndex + 1}))`,
    };
    
    const updatedClasses = [...classes, newClass];
    setClasses(updatedClasses);
    await saveClasses(taskId, updatedClasses);
    return newId;
  }, [classes, taskId]);

  const deleteClass = useCallback(async (id: number) => {
    const updatedClasses = classes.filter((c) => c.id !== id);
    setClasses(updatedClasses);
    await saveClasses(taskId, updatedClasses);
    
    // Update annotations that use this class
    setImageAnnotations((prev) => {
      const updated: ImageAnnotations = {};
      for (const imgId in prev) {
        updated[imgId] = prev[imgId].map((ann) =>
          ann.classId === id ? { ...ann, classId: 0 } : ann
        );
        scheduleSave(imgId);
      }
      return updated;
    });
    
    if (selectedClassId === id) {
      setSelectedClassId(0);
    }
  }, [classes, selectedClassId, taskId, scheduleSave]);

  const exportToYOLO = useCallback((imageId: string) => {
    const anns = imageAnnotations[imageId] || [];
    return anns
      .map((ann) => {
        return `${ann.classId} ${ann.x.toFixed(6)} ${ann.y.toFixed(6)} ${ann.width.toFixed(6)} ${ann.height.toFixed(6)}`;
      })
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
    
    setImageAnnotations((prev) => {
      const updated = { ...prev, [currentImage.id]: newAnnotations };
      setTimeout(() => scheduleSave(currentImage.id), 0);
      return updated;
    });
  }, [currentImage, scheduleSave]);

  const getAnnotationCount = useCallback((imageId: string) => {
    return (imageAnnotations[imageId] || []).length;
  }, [imageAnnotations]);

  const getTotalAnnotations = useCallback(() => {
    return Object.values(imageAnnotations).reduce((sum, anns) => sum + anns.length, 0);
  }, [imageAnnotations]);

  const getAnnotatedImagesCount = useCallback(() => {
    return Object.entries(imageAnnotations).filter(([_, anns]) => anns.length > 0).length;
  }, [imageAnnotations]);

  // Get blob for export
  const getImageBlob = useCallback(async (imageId: string): Promise<Blob | null> => {
    const storedImages = await getTaskImages(taskId);
    const stored = storedImages.find((img) => img.id === imageId);
    return stored?.blob || null;
  }, [taskId]);

  return {
    images,
    currentImage,
    currentImageIndex,
    annotations,
    imageAnnotations,
    classes,
    selectedClassId,
    selectedAnnotationId,
    loading,
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