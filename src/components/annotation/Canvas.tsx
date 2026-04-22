import { useRef, useState, useCallback, useEffect } from "react";
import { BoundingBox, AnnotationClass, DrawingState, ImageData } from "@/types/annotation";
import { ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CanvasProps {
  image: ImageData | null;
  annotations: BoundingBox[];
  classes: AnnotationClass[];
  selectedClassId: number | null;
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
  const fallbackClass: AnnotationClass = {
    id: -1,
    name: "Unassigned",
    color: "hsl(var(--muted-foreground))",
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState<DrawingState | null>(null);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  
  // Zoom state
  const [zoom, setZoom] = useState(1);

  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 5;
  const ZOOM_STEP = 0.25;

  // Calculate displayed image size and container size
  useEffect(() => {
    if (!containerRef.current || !image) return;

    const updateSize = () => {
      const container = containerRef.current!;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      setContainerSize({ width: containerWidth, height: containerHeight });

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

  // Reset zoom when image changes
  useEffect(() => {
    setZoom(1);
  }, [image]);

  // Center scroll position when zoom changes
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    
    // Calculate center position
    const scrollWidth = container.scrollWidth;
    const scrollHeight = container.scrollHeight;
    const clientWidth = container.clientWidth;
    const clientHeight = container.clientHeight;
    
    container.scrollLeft = (scrollWidth - clientWidth) / 2;
    container.scrollTop = (scrollHeight - clientHeight) / 2;
  }, [zoom, canvasSize]);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(MAX_ZOOM, prev + ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(MIN_ZOOM, prev - ZOOM_STEP));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoom(1);
  }, []);

  // Mouse wheel zoom with Ctrl
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setZoom((prev) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta)));
    }
    // Normal scroll is handled by the scrollable container
  }, []);

  const getMousePosition = useCallback(
    (e: React.MouseEvent) => {
      if (!scrollContainerRef.current) return { x: 0, y: 0 };

      const scrollContainer = scrollContainerRef.current;
      const rect = scrollContainer.getBoundingClientRect();
      
      // Account for scroll position
      const scrollLeft = scrollContainer.scrollLeft;
      const scrollTop = scrollContainer.scrollTop;
      
      // Calculate the padding around the image
      const scaledWidth = canvasSize.width * zoom;
      const scaledHeight = canvasSize.height * zoom;
      const paddingX = Math.max(containerSize.width / 2, scaledWidth / 2);
      const paddingY = Math.max(containerSize.height / 2, scaledHeight / 2);
      
      // Calculate position relative to the image
      const imageLeft = paddingX - scaledWidth / 2;
      const imageTop = paddingY - scaledHeight / 2;
      
      const x = (e.clientX - rect.left + scrollLeft - imageLeft) / scaledWidth;
      const y = (e.clientY - rect.top + scrollTop - imageTop) / scaledHeight;

      return {
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
      };
    },
    [canvasSize, containerSize, zoom]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!image) return;

      const pos = getMousePosition(e);

      if (tool === "draw") {
        if (selectedClassId === null) return;
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
    return classes.find((c) => c.id === classId) || classes[0] || fallbackClass;
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
    if (!drawing || selectedClassId === null) return {};
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

  const scaledWidth = canvasSize.width * zoom;
  const scaledHeight = canvasSize.height * zoom;
  const paddingX = Math.max(containerSize.width / 2, scaledWidth / 2);
  const paddingY = Math.max(containerSize.height / 2, scaledHeight / 2);

  return (
    <div
      ref={containerRef}
      className="flex-1 annotation-canvas relative overflow-hidden"
      onWheel={handleWheel}
    >
      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-card/90 backdrop-blur-sm rounded-lg p-1 border border-border shadow-lg">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleZoomOut}
          disabled={zoom <= MIN_ZOOM}
          className="h-8 w-8 p-0"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-xs font-mono w-12 text-center text-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleZoomIn}
          disabled={zoom >= MAX_ZOOM}
          className="h-8 w-8 p-0"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleResetZoom}
          disabled={zoom === 1}
          className="h-8 w-8 p-0"
        >
          <Maximize className="w-4 h-4" />
        </Button>
      </div>

      {image ? (
        <div
          ref={scrollContainerRef}
          className="w-full h-full overflow-auto scrollbar-thin"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: tool === "draw" ? "crosshair" : "default" }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: paddingX * 2,
              height: paddingY * 2,
              minWidth: "100%",
              minHeight: "100%",
            }}
          >
            <div
              className="relative flex-shrink-0"
              style={{
                width: scaledWidth,
                height: scaledHeight,
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
                    className="absolute -top-5 left-0 text-xs font-medium px-1 rounded whitespace-nowrap"
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
          </div>
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-center text-muted-foreground">
          <div>
            <div className="text-6xl mb-4">🖼️</div>
            <p className="text-lg font-medium">No image loaded</p>
            <p className="text-sm mt-1">Upload an image to start annotating</p>
          </div>
        </div>
      )}

      {/* Zoom hint */}
      {image && zoom === 1 && (
        <div className="absolute bottom-3 right-3 z-10 text-xs text-muted-foreground bg-card/80 px-2 py-1 rounded">
          <kbd className="px-1 py-0.5 bg-muted rounded">Ctrl</kbd> + scroll to zoom
        </div>
      )}
    </div>
  );
};
