import type React from "react";

import { useState, useEffect } from "react";
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
import { PublicUserProfile } from "@/components/user/PublicUserProfile";

interface EditMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: BoardMember;
  onUpdateMember: (member: BoardMember) => void;
}

export function EditMemberDialog({
  open,
  onOpenChange,
  member,
  onUpdateMember,
}: EditMemberDialogProps) {
  const [title, setTitle] = useState(member.title);
  const [startDate, setStartDate] = useState(member.startDate);
  const [endDate, setEndDate] = useState(member.endDate);

  useEffect(() => {
    setTitle(member.title);
    setStartDate(member.startDate);
    setEndDate(member.endDate);
  }, [member]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate || !endDate) {
      return;
    }

    onUpdateMember({
      ...member,
      title,
      startDate,
      endDate,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Board Member</DialogTitle>
          <DialogDescription>Update member information</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <PublicUserProfile
            firstName={member.firstName}
            lastName={member.lastName}
            email={member.email}
          />

          <div>
            <Label htmlFor="edit-member-title">Title</Label>
            <Input
              id="edit-member-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-start-date">Start Date</Label>
              <Input
                id="edit-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="edit-end-date">End Date</Label>
              <Input
                id="edit-end-date"
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
            <Button type="submit" disabled={!title.trim() || !startDate || !endDate}>
              Update Member
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
