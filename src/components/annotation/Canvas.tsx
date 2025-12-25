import { useRef, useState, useCallback, useEffect } from "react";
import { BoundingBox, AnnotationClass, DrawingState, ImageData } from "@/types/annotation";

interface CanvasProps {
  image: ImageData | null;
  annotations: BoundingBox[];
  classes: AnnotationClass[];
  selectedClassId: number;
  selectedAnnotationId: string | null;
  tool: "select" | "draw";
  onAddAnnotation: (box: Omit<BoundingBox, "id">) => void;
  onUpdateAnnotation: (id: string, updates: Partial<BoundingBox>) => void;
  onSelectAnnotation: (id: string | null) => void;
}

export const Canvas = ({
  image,
  annotations,
  classes,
  selectedClassId,
  selectedAnnotationId,
  tool,
  onAddAnnotation,
  onUpdateAnnotation,
  onSelectAnnotation,
}: CanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState<DrawingState | null>(null);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Calculate displayed image size
  useEffect(() => {
    if (!containerRef.current || !image) return;

    const updateSize = () => {
      const container = containerRef.current!;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      const imageAspect = image.width / image.height;
      const containerAspect = containerWidth / containerHeight;

      let displayWidth: number;
      let displayHeight: number;

      if (imageAspect > containerAspect) {
        displayWidth = containerWidth;
        displayHeight = containerWidth / imageAspect;
      } else {
        displayHeight = containerHeight;
        displayWidth = containerHeight * imageAspect;
      }

      setCanvasSize({ width: displayWidth, height: displayHeight });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [image]);

  const getMousePosition = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return { x: 0, y: 0 };

      const rect = containerRef.current.getBoundingClientRect();
      const offsetX = (rect.width - canvasSize.width) / 2;
      const offsetY = (rect.height - canvasSize.height) / 2;

      const x = (e.clientX - rect.left - offsetX) / canvasSize.width;
      const y = (e.clientY - rect.top - offsetY) / canvasSize.height;

      return {
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
      };
    },
    [canvasSize]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!image) return;

      const pos = getMousePosition(e);

      if (tool === "draw") {
        setDrawing({
          isDrawing: true,
          startX: pos.x,
          startY: pos.y,
          currentX: pos.x,
          currentY: pos.y,
        });
        onSelectAnnotation(null);
      }
    },
    [image, tool, getMousePosition, onSelectAnnotation]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const pos = getMousePosition(e);

      if (drawing) {
        setDrawing((prev) =>
          prev ? { ...prev, currentX: pos.x, currentY: pos.y } : null
        );
      } else if (dragging) {
        const ann = annotations.find((a) => a.id === dragging.id);
        if (ann) {
          const newX = Math.max(ann.width / 2, Math.min(1 - ann.width / 2, pos.x - dragging.offsetX + ann.width / 2));
          const newY = Math.max(ann.height / 2, Math.min(1 - ann.height / 2, pos.y - dragging.offsetY + ann.height / 2));
          onUpdateAnnotation(dragging.id, { x: newX, y: newY });
        }
      }
    },
    [drawing, dragging, annotations, getMousePosition, onUpdateAnnotation]
  );

  const handleMouseUp = useCallback(() => {
    if (drawing) {
      const minX = Math.min(drawing.startX, drawing.currentX);
      const maxX = Math.max(drawing.startX, drawing.currentX);
      const minY = Math.min(drawing.startY, drawing.currentY);
      const maxY = Math.max(drawing.startY, drawing.currentY);

      const width = maxX - minX;
      const height = maxY - minY;

      // Only create if box is large enough
      if (width > 0.01 && height > 0.01) {
        onAddAnnotation({
          classId: selectedClassId,
          x: minX + width / 2,
          y: minY + height / 2,
          width,
          height,
        });
      }

      setDrawing(null);
    }

    if (dragging) {
      setDragging(null);
    }
  }, [drawing, dragging, selectedClassId, onAddAnnotation]);

  const handleBoxMouseDown = useCallback(
    (e: React.MouseEvent, ann: BoundingBox) => {
      e.stopPropagation();

      if (tool === "select") {
        onSelectAnnotation(ann.id);
        const pos = getMousePosition(e);
        const boxLeft = ann.x - ann.width / 2;
        const boxTop = ann.y - ann.height / 2;
        setDragging({
          id: ann.id,
          offsetX: pos.x - boxLeft,
          offsetY: pos.y - boxTop,
        });
      }
    },
    [tool, getMousePosition, onSelectAnnotation]
  );

  const getClass = (classId: number) => {
    return classes.find((c) => c.id === classId) || classes[0];
  };

  const getBoxStyle = (ann: BoundingBox) => {
    const cls = getClass(ann.classId);
    return {
      left: `${(ann.x - ann.width / 2) * 100}%`,
      top: `${(ann.y - ann.height / 2) * 100}%`,
      width: `${ann.width * 100}%`,
      height: `${ann.height * 100}%`,
      borderColor: cls.color,
      backgroundColor: `${cls.color.replace(")", " / 0.1)")}`,
    };
  };

  const getDrawingStyle = () => {
    if (!drawing) return {};
    const cls = getClass(selectedClassId);
    const minX = Math.min(drawing.startX, drawing.currentX);
    const maxX = Math.max(drawing.startX, drawing.currentX);
    const minY = Math.min(drawing.startY, drawing.currentY);
    const maxY = Math.max(drawing.startY, drawing.currentY);

    return {
      left: `${minX * 100}%`,
      top: `${minY * 100}%`,
      width: `${(maxX - minX) * 100}%`,
      height: `${(maxY - minY) * 100}%`,
      borderColor: cls.color,
      backgroundColor: `${cls.color.replace(")", " / 0.15)")}`,
    };
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 annotation-canvas flex items-center justify-center overflow-hidden"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {image ? (
        <div
          className="relative"
          style={{
            width: canvasSize.width,
            height: canvasSize.height,
          }}
        >
          <img
            src={image.src}
            alt={image.name}
            className="w-full h-full object-contain pointer-events-none select-none"
            draggable={false}
          />

          {/* Existing annotations */}
          {annotations.map((ann) => (
            <div
              key={ann.id}
              className={`annotation-box ${
                selectedAnnotationId === ann.id ? "annotation-box-selected" : ""
              }`}
              style={getBoxStyle(ann)}
              onMouseDown={(e) => handleBoxMouseDown(e, ann)}
            >
              <span
                className="absolute -top-5 left-0 text-xs font-medium px-1 rounded"
                style={{
                  backgroundColor: getClass(ann.classId).color,
                  color: "hsl(var(--background))",
                }}
              >
                {getClass(ann.classId).name}
              </span>
            </div>
          ))}

          {/* Drawing preview */}
          {drawing && (
            <div
              className="absolute border-2 border-dashed pointer-events-none"
              style={getDrawingStyle()}
            />
          )}
        </div>
      ) : (
        <div className="text-center text-muted-foreground">
          <div className="text-6xl mb-4">🖼️</div>
          <p className="text-lg font-medium">No image loaded</p>
          <p className="text-sm mt-1">Upload an image to start annotating</p>
        </div>
      )}
    </div>
  );
};
