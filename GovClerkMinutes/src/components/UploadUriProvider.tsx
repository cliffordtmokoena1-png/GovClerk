import { UploadKind } from "@/uploadKind/uploadKind";
import React, { createContext, useState } from "react";

export type UploadData = {
  filename: string;
  kind: UploadKind;
  uri: string;
};

type UploadUriMap = {
  [transcriptId: number]: UploadData;
};
export const UploadUriContext = createContext<{
  uploadUriMap: UploadUriMap;
  updateUploadUri: (transcriptId: number, uploadData: UploadData) => void;
}>({
  uploadUriMap: {},
  updateUploadUri: (_transcriptId: number, _uploadData: UploadData) => ({}),
});

type Props = {
  children: React.ReactNode;
};

export function UploadUriProvider({ children }: Props) {
  const [audioUriMap, setUploadUriMap] = useState<UploadUriMap>({});

  const updateUploadUri = (transcriptId: number, uploadData: UploadData) => {
    setUploadUriMap((prevMap) => ({
      ...prevMap,
      [transcriptId]: uploadData,
    }));
  };

  return (
    <UploadUriContext.Provider value={{ uploadUriMap: audioUriMap, updateUploadUri }}>
      {children}
    </UploadUriContext.Provider>
  );
}
