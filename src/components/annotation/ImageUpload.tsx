import { useRef } from "react";
import { Upload, Image as ImageIcon, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageData } from "@/types/annotation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  images: ImageData[];
  currentImageIndex: number;
  onImagesLoad: (images: ImageData[]) => void;
  onImageSelect: (index: number) => void;
  onImageRemove: (imageId: string) => void;
  getAnnotationCount: (imageId: string) => number;
}

export const ImageUpload = ({
  images,
  currentImageIndex,
  onImagesLoad,
  onImageSelect,
  onImageRemove,
  getAnnotationCount,
}: ImageUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const loadedImages: ImageData[] = [];
    let loadedCount = 0;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          loadedImages.push({
            id: crypto.randomUUID(),
            src: event.target?.result as string,
            name: file.name,
            width: img.naturalWidth,
            height: img.naturalHeight,
            file: file,
          });
          loadedCount++;

          if (loadedCount === files.length) {
            // Sort by filename
            loadedImages.sort((a, b) => a.name.localeCompare(b.name));
            onImagesLoad(loadedImages);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    e.target.value = "";
  };

  return (
    <div className="flex flex-col border-b border-border">
      <div className="p-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />

        <Button
          variant="outline"
          onClick={() => inputRef.current?.click()}
          className="w-full gap-2"
        >
          <Upload className="w-4 h-4" />
          {images.length === 0 ? "Upload Images" : "Add More Images"}
        </Button>
      </div>

      {images.length > 0 && (
        <div className="px-3 pb-2">
          <div className="text-xs text-muted-foreground mb-2">
            {images.length} image{images.length !== 1 ? "s" : ""} loaded
          </div>
          <ScrollArea className="h-32">
            <div className="space-y-1">
              {images.map((image, index) => {
                const annotationCount = getAnnotationCount(image.id);
                const isSelected = index === currentImageIndex;
                
                return (
                  <div
                    key={image.id}
                    className={cn(
                      "flex items-center gap-2 p-1.5 rounded cursor-pointer group transition-colors",
                      isSelected
                        ? "bg-primary/10 border border-primary/30"
                        : "hover:bg-muted/50"
                    )}
                    onClick={() => onImageSelect(index)}
                  >
                    <img
                      src={image.src}
                      alt={image.name}
                      className="w-8 h-8 object-cover rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs truncate text-foreground">
                        {image.name}
                      </div>
                      <div className="flex items-center gap-1">
                        {annotationCount > 0 ? (
                          <span className="text-xs text-primary flex items-center gap-0.5">
                            <Check className="w-3 h-3" />
                            {annotationCount}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            No annotations
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        onImageRemove(image.id);
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
};
