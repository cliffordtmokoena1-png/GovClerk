type MediaCheckResult =
  | {
      isCorrupted: false;
    }
  | {
      isCorrupted: true;
      message: string;
    };

export default async function isMediaCorrupted(file: File): Promise<MediaCheckResult> {
  // Function to create and test the media element
  const testMediaElement = (element: HTMLMediaElement): Promise<MediaCheckResult> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      element.src = url;

      element.onloadeddata = () => {
        URL.revokeObjectURL(url);
        resolve({ isCorrupted: false });
      };

      element.onerror = (e) => {
        URL.revokeObjectURL(url);
        resolve({ isCorrupted: true, message: String(e) }); // Resolve with null if this attempt fails
      };

      element.load();
    });
  };

  // First, try as an audio file
  const audioResult = await testMediaElement(new Audio());
  if (!audioResult.isCorrupted) {
    return audioResult;
  }

  // If audio fails, try as a video file
  const videoResult = await testMediaElement(document.createElement("video"));
  if (!videoResult.isCorrupted) {
    return videoResult;
  }

  // If both audio and video fail, file is corrupted
  return {
    isCorrupted: true,
    message: `${file.name} is unplayable as audio or video.  This usually means the file is corrupted.`,
  };
}
