import type React from "react";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BoardMember } from "@/board/types";
import { cn } from "@/utils/classname";
import { useOrgContext } from "@/contexts/OrgContext";
import { PublicUserProfile } from "@/components/user/PublicUserProfile";
import { Spinner } from "../ui/spinner";

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddMember: (member: BoardMember) => void;
}

interface UserResult {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  imageUrl?: string;
}

export function AddMemberDialog({ open, onOpenChange, onAddMember }: AddMemberDialogProps) {
  const { orgId } = useOrgContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState<string | undefined>(undefined);
  const [lastName, setLastName] = useState<string | undefined>(undefined);
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim() || userId) {
        // Don't search if we already selected a user (userId is set) or searchQuery is empty
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const res = await fetch(`/api/org/users/search?query=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
          setShowResults(true);
        }
      } catch (error) {
        console.error("Error searching users:", error);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(searchUsers, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, orgId, userId]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setUserId(undefined); // Reset selected user if search query changes manually
  };

  const handleSelectUser = (user: UserResult) => {
    setSearchQuery(user.name);
    setUserId(user.id);
    setEmail(user.email || "");
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setImageUrl(user.imageUrl);
    setShowResults(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !title.trim() || !startDate || !endDate) {
      return;
    }

    const newMember: BoardMember = {
      userId,
      email,
      firstName,
      lastName,
      title,
      startDate,
      endDate,
    };

    onAddMember(newMember);
    setSearchQuery("");
    setUserId(undefined);
    setEmail("");
    setFirstName(undefined);
    setLastName(undefined);
    setImageUrl(undefined);
    setTitle("");
    setStartDate("");
    setEndDate("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Board Member</DialogTitle>
          <DialogDescription>Add a new member to this board</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!userId && (
            <div className="relative" ref={searchRef}>
              <Label htmlFor="member-search">Search User</Label>
              <Input
                id="member-search"
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => {
                  if (searchResults.length > 0 && !userId) {
                    setShowResults(true);
                  }
                }}
                placeholder="Search for a user"
                className="mt-1"
                autoComplete="off"
              />
              {isSearching && (
                <div className="absolute z-10 w-full mt-1 bg-popover text-popover-foreground rounded-md border shadow-md max-h-60 overflow-auto bg-white dark:bg-gray-900">
                  <Spinner className="w-full h-6" />
                </div>
              )}
              {showResults && searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-popover text-popover-foreground rounded-md border shadow-md max-h-60 overflow-auto bg-white dark:bg-gray-900">
                  {searchResults.map((user) => (
                    <div
                      key={user.id}
                      className="px-4 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
                      onClick={() => handleSelectUser(user)}
                    >
                      {user.imageUrl && (
                        <img src={user.imageUrl} alt="" className="w-6 h-6 rounded-full" />
                      )}
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{user.name}</span>
                        {user.email && (
                          <span className="text-xs text-muted-foreground">{user.email}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {userId && (
            <PublicUserProfile
              firstName={firstName}
              lastName={lastName}
              email={email}
              imageUrl={imageUrl}
              onClear={() => {
                setUserId(undefined);
                setSearchQuery("");
                setEmail("");
                setFirstName(undefined);
                setLastName(undefined);
                setImageUrl(undefined);
              }}
            />
          )}

          <div>
            <Label htmlFor="member-title">Title</Label>
            <Input
              id="member-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Chairman, Secretary"
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!userId || !title.trim() || !startDate || !endDate}>
              Add Member
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
