import withErrorReporting from "@/error/withErrorReporting";
import { connect } from "@planetscale/database";
import { NextRequest } from "next/server";
import type { PublicPortalResponse } from "@/types/portal";

export const config = {
  runtime: "edge",
};

function getConnection() {
  return connect({
    host: process.env.PLANETSCALE_DB_HOST,
    username: process.env.PLANETSCALE_DB_USERNAME,
    password: process.env.PLANETSCALE_DB_PASSWORD,
  });
}

async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const slug = pathParts[pathParts.length - 1];

  if (!slug) {
    return new Response(JSON.stringify({ error: "Portal slug is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const conn = getConnection();

  const result = await conn.execute(
    `SELECT id, slug, page_title, page_description, logo_url, header_bg_color, header_text_color, accent_color, nav_links
     FROM gc_portal_settings
     WHERE slug = ? AND is_enabled = true`,
    [slug]
  );

  if (result.rows.length === 0) {
    return new Response(JSON.stringify({ error: "Portal not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const row = result.rows[0] as any;

  // nav_links may already be parsed by PlanetScale driver or still be a string
  let navLinks = row.nav_links;
  if (typeof navLinks === "string") {
    navLinks = JSON.parse(navLinks);
  }

  const response: PublicPortalResponse = {
    settings: {
      id: row.id,
      slug: row.slug,
      pageTitle: row.page_title,
      pageDescription: row.page_description,
      logoUrl: row.logo_url,
      headerBgColor: row.header_bg_color,
      headerTextColor: row.header_text_color,
      accentColor: row.accent_color,
      navLinks: navLinks || null,
    },
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export default withErrorReporting(handler);
