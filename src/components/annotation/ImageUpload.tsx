import { useRef } from "react";
import { Upload, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageData } from "@/types/annotation";

interface ImageUploadProps {
  image: ImageData | null;
  onImageLoad: (image: ImageData) => void;
}

export const ImageUpload = ({ image, onImageLoad }: ImageUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        onImageLoad({
          src: event.target?.result as string,
          name: file.name,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);

    // Reset input
    e.target.value = "";
  };

  return (
    <div className="p-3 border-b border-border">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {image ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <ImageIcon className="w-4 h-4 text-muted-foreground" />
            <span className="truncate flex-1">{image.name}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {image.width} × {image.height}px
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            className="w-full"
          >
            Change Image
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          onClick={() => inputRef.current?.click()}
          className="w-full gap-2"
        >
          <Upload className="w-4 h-4" />
          Upload Image
        </Button>
      )}
    </div>
  );
};
