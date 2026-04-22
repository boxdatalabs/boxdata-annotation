import { useState, useCallback, useEffect, useRef } from "react";
import {
  BoundingBox,
  AnnotationClass,
  CLASS_COLORS,
  ImageData,
  ImageAnnotations,
} from "@/types/annotation";
import {
  addImage,
  deleteImage as deleteStoredImage,
  getTaskAnnotations,
  getTaskClasses,
  getTaskImages,
  saveAnnotations,
  saveClasses,
} from "@/lib/db";

const FALLBACK_CLASS_ID = -1;

export const useTaskAnnotations = (taskId: string) => {
  const [images, setImages] = useState<ImageData[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [imageAnnotations, setImageAnnotations] = useState<ImageAnnotations>({});
  const [classes, setClasses] = useState<AnnotationClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const objectUrlsRef = useRef<Record<string, string>>({});

  const currentImage = images[currentImageIndex] || null;
  const annotations = currentImage ? (imageAnnotations[currentImage.id] || []) : [];

  const revokeImageUrl = useCallback((imageId: string) => {
    const url = objectUrlsRef.current[imageId];
    if (url) {
      URL.revokeObjectURL(url);
      delete objectUrlsRef.current[imageId];
    }
  }, []);

  const persistAnnotationsForImage = useCallback(
    async (imageId: string, nextAnnotations: BoundingBox[]) => {
      if (!taskId) return;
      await saveAnnotations(imageId, taskId, nextAnnotations);
    },
    [taskId]
  );

  const persistClassesForTask = useCallback(
    async (nextClasses: AnnotationClass[]) => {
      if (!taskId) return;
      await saveClasses(taskId, nextClasses);
    },
    [taskId]
  );

  useEffect(() => {
    let isMounted = true;

    const loadTaskData = async () => {
      if (!taskId) {
        if (!isMounted) return;
        setImages([]);
        setImageAnnotations({});
        setClasses([]);
        setSelectedClassId(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const [storedImages, storedAnnotations, storedClasses] = await Promise.all([
          getTaskImages(taskId),
          getTaskAnnotations(taskId),
          getTaskClasses(taskId),
        ]);

        if (!isMounted) return;

        Object.keys(objectUrlsRef.current).forEach((imageId) => revokeImageUrl(imageId));

        const hydratedImages: ImageData[] = storedImages.map((image) => {
          const src = URL.createObjectURL(image.blob);
          objectUrlsRef.current[image.id] = src;

          return {
            id: image.id,
            src,
            name: image.name,
            width: image.width,
            height: image.height,
          };
        });

        setImages(hydratedImages);
        setImageAnnotations(storedAnnotations);
        setClasses(storedClasses);
        setSelectedClassId((prev) => {
          if (storedClasses.length === 0) return null;
          if (prev !== null && storedClasses.some((cls) => cls.id === prev)) return prev;
          return storedClasses[0].id;
        });
        setCurrentImageIndex((prev) => Math.min(prev, Math.max(0, hydratedImages.length - 1)));
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadTaskData();

    return () => {
      isMounted = false;
      Object.keys(objectUrlsRef.current).forEach((imageId) => revokeImageUrl(imageId));
    };
  }, [taskId, revokeImageUrl]);

  useEffect(() => {
    setCurrentImageIndex((prev) => Math.min(prev, Math.max(0, images.length - 1)));
  }, [images.length]);

  const addImages = useCallback(async (newImages: ImageData[]) => {
    const existingIds = new Set(images.map((img) => img.id));
    const unique = newImages.filter((img) => !existingIds.has(img.id));

    if (unique.length === 0) return;

    if (taskId) {
      await Promise.all(
        unique.map(async (image) => {
          const blob = image.file ?? (await fetch(image.src).then((response) => response.blob()));
          await addImage({
            id: image.id,
            taskId,
            name: image.name,
            width: image.width,
            height: image.height,
            blob,
          });
        })
      );
    }

    setImages((prev) => [...prev, ...unique]);
  }, [images, taskId]);

  const removeImage = useCallback((imageId: string) => {
    setImages((prev) => {
      const index = prev.findIndex((img) => img.id === imageId);
      const newImages = prev.filter((img) => img.id !== imageId);
      if (newImages.length === 0) {
        setCurrentImageIndex(0);
      } else if (index <= currentImageIndex && currentImageIndex > 0) {
        setCurrentImageIndex(currentImageIndex - 1);
      }
      return newImages;
    });

    revokeImageUrl(imageId);
    if (taskId) {
      void deleteStoredImage(imageId);
    }

    setImageAnnotations((prev) => {
      const { [imageId]: _, ...rest } = prev;
      return rest;
    });
  }, [currentImageIndex, revokeImageUrl, taskId]);

  const addAnnotation = useCallback((box: Omit<BoundingBox, "id">) => {
    if (!currentImage) return "";
    const newAnnotation: BoundingBox = {
      ...box,
      id: crypto.randomUUID(),
    };
    setImageAnnotations((prev) => {
      const nextAnnotations = [...(prev[currentImage.id] || []), newAnnotation];
      void persistAnnotationsForImage(currentImage.id, nextAnnotations);

      return {
        ...prev,
        [currentImage.id]: nextAnnotations,
      };
    });
    setSelectedAnnotationId(newAnnotation.id);
    return newAnnotation.id;
  }, [currentImage, persistAnnotationsForImage]);

  const updateAnnotation = useCallback((id: string, updates: Partial<BoundingBox>) => {
    if (!currentImage) return;
    setImageAnnotations((prev) => {
      const nextAnnotations = (prev[currentImage.id] || []).map((ann) =>
        ann.id === id ? { ...ann, ...updates } : ann
      );
      void persistAnnotationsForImage(currentImage.id, nextAnnotations);

      return {
        ...prev,
        [currentImage.id]: nextAnnotations,
      };
    });
  }, [currentImage, persistAnnotationsForImage]);

  const deleteAnnotation = useCallback((id: string) => {
    if (!currentImage) return;
    setImageAnnotations((prev) => {
      const nextAnnotations = (prev[currentImage.id] || []).filter((ann) => ann.id !== id);
      void persistAnnotationsForImage(currentImage.id, nextAnnotations);

      return {
        ...prev,
        [currentImage.id]: nextAnnotations,
      };
    });
    if (selectedAnnotationId === id) {
      setSelectedAnnotationId(null);
    }
  }, [currentImage, persistAnnotationsForImage, selectedAnnotationId]);

  const clearAnnotations = useCallback(() => {
    if (!currentImage) return;
    setImageAnnotations((prev) => ({ ...prev, [currentImage.id]: [] }));
    setSelectedAnnotationId(null);
    void persistAnnotationsForImage(currentImage.id, []);
  }, [currentImage, persistAnnotationsForImage]);

  const addClass = useCallback((name: string) => {
    const newId = classes.length > 0 ? Math.max(...classes.map(c => c.id)) + 1 : 0;
    const colorIndex = newId % CLASS_COLORS.length;
    const newClass: AnnotationClass = {
      id: newId,
      name,
      color: CLASS_COLORS[colorIndex],
    };
    setClasses((prev) => {
      const nextClasses = [...prev, newClass];
      void persistClassesForTask(nextClasses);
      return nextClasses;
    });
    setSelectedClassId((prev) => prev ?? newId);
    return newId;
  }, [classes, persistClassesForTask]);

  const deleteClass = useCallback((id: number) => {
    setImageAnnotations((prev) => {
      const fallbackClassId = classes.find((c) => c.id !== id)?.id ?? FALLBACK_CLASS_ID;
      const updated: ImageAnnotations = {};
      for (const imgId in prev) {
        updated[imgId] = prev[imgId].map((ann) =>
          ann.classId === id && fallbackClassId !== FALLBACK_CLASS_ID
            ? { ...ann, classId: fallbackClassId }
            : ann
        );
        void persistAnnotationsForImage(imgId, updated[imgId]);
      }
      return updated;
    });
    setClasses((prev) => {
      const nextClasses = prev.filter((c) => c.id !== id);
      void persistClassesForTask(nextClasses);
      return nextClasses;
    });
    if (selectedClassId === id) {
      const fallbackClassId = classes.find((c) => c.id !== id)?.id ?? null;
      setSelectedClassId(fallbackClassId);
    }
  }, [classes, persistAnnotationsForImage, persistClassesForTask, selectedClassId]);

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
    void persistAnnotationsForImage(currentImage.id, newAnnotations);
  }, [currentImage, persistAnnotationsForImage]);

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
