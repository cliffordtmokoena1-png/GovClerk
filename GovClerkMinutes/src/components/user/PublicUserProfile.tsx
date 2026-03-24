import React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PublicUserProfileProps {
  firstName?: string;
  lastName?: string;
  email: string;
  imageUrl?: string;
  onClear?: () => void;
}

export function PublicUserProfile({
  firstName,
  lastName,
  email,
  imageUrl,
  onClear,
}: PublicUserProfileProps) {
  return (
    <div className="p-4 border rounded-md bg-muted/20 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="w-10 h-10 rounded-full" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            {(firstName?.[0] || "") + (lastName?.[0] || "")}
          </div>
        )}
        <div>
          <div className="font-medium">
            {firstName} {lastName}
          </div>
          <div className="text-sm text-muted-foreground">{email}</div>
        </div>
      </div>
      {onClear && (
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClear}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
