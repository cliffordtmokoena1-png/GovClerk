export interface BoardMember {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  title: string;
  startDate: string;
  endDate: string;
}

export interface Meeting {
  id: string;
  date: string;
  time: string;
  title: string;
}

export interface Board {
  id: string;
  name: string;
  members: BoardMember[];
  meetings: Meeting[];
}

export interface UserMetadata {
  boardMemberships: {
    boardId: string;
    boardName: string;
    title: string;
    startDate: string;
    endDate: string;
  }[];
}
