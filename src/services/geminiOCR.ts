import { BoundingBox } from "@/types/annotation";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

export interface TextRegion {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const getGeminiApiKey = (): string | null => {
  return localStorage.getItem("gemini_api_key");
};

export const setGeminiApiKey = (key: string): void => {
  localStorage.setItem("gemini_api_key", key);
};

export const removeGeminiApiKey = (): void => {
  localStorage.removeItem("gemini_api_key");
};

const imageToBase64 = async (imageSrc: string): Promise<string> => {
  // If it's already a data URL, extract the base64 part
  if (imageSrc.startsWith("data:")) {
    return imageSrc.split(",")[1];
  }

  // If it's a blob URL, fetch and convert
  const response = await fetch(imageSrc);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const detectTextRegions = async (
  imageSrc: string,
  classId: number
): Promise<BoundingBox[]> => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Gemini API key not configured. Please add your API key in settings.");
  }

  const base64Image = await imageToBase64(imageSrc);

  const prompt = `Analyze this image and detect all text regions. For each text region found, provide the bounding box coordinates as a percentage of the image dimensions (0-100).

Return ONLY a JSON array with this exact format, no other text:
[
  {"text": "detected text", "x": 10, "y": 20, "width": 30, "height": 5},
  ...
]

Where:
- x, y: top-left corner position as percentage (0-100)
- width, height: size as percentage (0-100)

If no text is found, return an empty array: []`;

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: base64Image,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 1,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    if (response.status === 400) {
      throw new Error("Invalid API key or request. Please check your Gemini API key.");
    }
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    throw new Error(`API error: ${error}`);
  }

  const data = await response.json();
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textContent) {
    return [];
  }

  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = textContent;
  const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  try {
    const regions: TextRegion[] = JSON.parse(jsonStr.trim());
    
    // Convert to BoundingBox format (normalized 0-1, center-based)
    return regions.map((region, index) => ({
      id: `auto-${Date.now()}-${index}`,
      classId,
      // Convert from percentage (0-100) to normalized (0-1)
      // Convert from top-left to center
      x: (region.x + region.width / 2) / 100,
      y: (region.y + region.height / 2) / 100,
      width: region.width / 100,
      height: region.height / 100,
    }));
  } catch {
    console.error("Failed to parse Gemini response:", textContent);
    return [];
  }
};
