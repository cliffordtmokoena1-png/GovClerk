import { getAuth, createClerkClient } from "@clerk/nextjs/server";
import { connect } from "@planetscale/database";
import { NextRequest, NextResponse } from "next/server";
import { getClerkKeys } from "@/utils/clerk";
import { getSiteFromHeaders } from "@/utils/site";

export const config = {
  runtime: "edge",
};

export default async function handler(req: NextRequest) {
  const { userId, orgId } = getAuth(req);
  if (!userId || !orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });

  if (req.method === "GET") {
    try {
      const { rows: boards } = await conn.execute("SELECT * FROM gc_boards WHERE org_id = ?", [
        orgId,
      ]);

      const boardIds = boards.map((b: any) => b.id);
      let members: any[] = [];
      let meetings: any[] = [];

      if (boardIds.length > 0) {
        // Construct placeholders for IN clause
        const placeholders = boardIds.map(() => "?").join(",");
        const { rows: memberRows } = await conn.execute(
          `SELECT * FROM gc_board_members WHERE board_id IN (${placeholders}) AND org_id = ?`,
          [...boardIds, orgId]
        );
        members = memberRows;

        // Fetch meetings linked to these boards
        const { rows: meetingRows } = await conn.execute(
          `SELECT id, board_id, title, meeting_date FROM gc_meetings WHERE board_id IN (${placeholders}) AND org_id = ?`,
          [...boardIds, orgId]
        );
        meetings = meetingRows;
      }

      // Fetch user details from Clerk
      const userIds = [...new Set(members.map((m: any) => m.user_id))].filter(Boolean);
      let usersMap: Record<string, any> = {};

      if (userIds.length > 0) {
        const keys = getClerkKeys(getSiteFromHeaders(req.headers));
        const clerkClient = createClerkClient({
          secretKey: keys.secretKey,
          publishableKey: keys.publishableKey,
        });

        try {
          const users = await clerkClient.users.getUserList({
            userId: userIds,
            limit: 100, // Adjust limit as needed
          });
          users.data.forEach((user) => {
            usersMap[user.id] = user;
          });
        } catch (error) {
          console.error("Error fetching users from Clerk:", error);
        }
      }

      const result = boards.map((board: any) => {
        const boardId = Number(board.id);
        const boardMembers = members
          .filter((m: any) => Number(m.board_id) === boardId)
          .map((m: any) => {
            const user = usersMap[m.user_id];
            return {
              userId: m.user_id,
              firstName: user?.firstName || undefined,
              lastName: user?.lastName || undefined,
              email: user?.emailAddresses[0]?.emailAddress || "",
              title: m.title || "",
              startDate: m.start_date || "",
              endDate: m.end_date || "",
            };
          });

        // Map meetings linked to this board
        const boardMeetings = meetings
          .filter((m: any) => Number(m.board_id) === boardId)
          .map((m: any) => ({
            id: m.id.toString(),
            title: m.title || "",
            date: m.meeting_date || "",
            time: "", // Not stored separately in gc_meetings
          }));

        return {
          id: board.id.toString(),
          name: board.name,
          members: boardMembers,
          meetings: boardMeetings,
        };
      });

      return NextResponse.json(result);
    } catch (error) {
      console.error("Error fetching boards:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  }

  if (req.method === "POST") {
    try {
      const body = await req.json();
      const { name, members } = body;

      const { insertId } = await conn.execute(
        "INSERT INTO gc_boards (org_id, name) VALUES (?, ?)",
        [orgId, name]
      );
      const newBoardId = insertId;

      if (members && members.length > 0) {
        for (const member of members) {
          // Use member.userId
          await conn.execute(
            "INSERT INTO gc_board_members (board_id, org_id, user_id, title, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)",
            [newBoardId, orgId, member.userId, member.title, member.startDate, member.endDate]
          );
        }
      }

      return NextResponse.json({ id: newBoardId.toString(), ...body });
    } catch (error) {
      console.error("Error creating board:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  }

  if (req.method === "PUT") {
    try {
      const body = await req.json();
      const { id, name, members } = body;

      // Verify ownership
      const { rows: existing } = await conn.execute(
        "SELECT * FROM gc_boards WHERE id = ? AND org_id = ?",
        [id, orgId]
      );
      if (existing.length === 0) {
        return new Response("Not found or unauthorized", { status: 404 });
      }

      await conn.execute("UPDATE gc_boards SET name = ? WHERE id = ?", [name, id]);

      // Replace members
      await conn.execute("DELETE FROM gc_board_members WHERE board_id = ?", [id]);

      if (members && members.length > 0) {
        for (const member of members) {
          await conn.execute(
            "INSERT INTO gc_board_members (board_id, org_id, user_id, title, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)",
            [id, orgId, member.userId, member.title, member.startDate, member.endDate]
          );
        }
      }
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error updating board:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  }

  if (req.method === "DELETE") {
    try {
      const url = new URL(req.url);
      const id = url.searchParams.get("id");

      if (!id) {
        return new Response("Missing ID", { status: 400 });
      }

      // Verify ownership
      const { rows: existing } = await conn.execute(
        "SELECT * FROM gc_boards WHERE id = ? AND org_id = ?",
        [id, orgId]
      );
      if (existing.length === 0) {
        return new Response("Not found or unauthorized", { status: 404 });
      }

      await conn.execute("DELETE FROM gc_board_members WHERE board_id = ?", [id]);
      await conn.execute("DELETE FROM gc_boards WHERE id = ?", [id]);

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Error deleting board:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}
