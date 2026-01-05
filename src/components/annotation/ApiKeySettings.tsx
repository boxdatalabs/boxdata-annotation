import { useState, useEffect } from "react";
import { Settings, Key, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getGeminiApiKey, setGeminiApiKey, removeGeminiApiKey } from "@/services/geminiOCR";
import { toast } from "sonner";

export const ApiKeySettings = () => {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    const key = getGeminiApiKey();
    setHasKey(!!key);
    if (key) {
      setApiKey(key);
    }
  }, [open]);

  const handleSave = () => {
    if (!apiKey.trim()) {
      toast.error("Please enter an API key");
      return;
    }
    setGeminiApiKey(apiKey.trim());
    setHasKey(true);
    toast.success("API key saved");
    setOpen(false);
  };

  const handleRemove = () => {
    removeGeminiApiKey();
    setApiKey("");
    setHasKey(false);
    toast.info("API key removed");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Settings className="w-4 h-4" />
          {hasKey && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            Gemini API Key
          </DialogTitle>
          <DialogDescription>
            Enter your Google Gemini API key to enable auto-annotation with OCR/text detection.
            Get your key from{" "}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Google AI Studio
            </a>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="Enter your Gemini API key..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="flex-1"
            />
          </div>
          <div className="flex justify-between">
            {hasKey && (
              <Button variant="destructive" size="sm" onClick={handleRemove}>
                <X className="w-4 h-4 mr-1" />
                Remove
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                <Check className="w-4 h-4 mr-1" />
                Save
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
