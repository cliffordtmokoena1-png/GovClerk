const fs = require("fs");
const path = require("path");

const POSTS_PATH = path.join(process.cwd(), "src", "blog", "posts");
const CONFIG_PATH = path.join(process.cwd(), "src", "components", "landing", "pseo", "config.ts");
const SITEMAP_PATH = path.join(process.cwd(), "public", "sitemap.xml");
const CD_SITEMAP_PATH = path.join(process.cwd(), "public", "GovClerk-sitemap.xml");

function getAllBlogPostSlugs() {
  const slugs = fs.readdirSync(POSTS_PATH);
  return slugs.map((slug) => slug.replace(".md", ""));
}

function getAdditionalSlugs() {
  try {
    const configContent = fs.readFileSync(CONFIG_PATH, "utf8");

    // Extract the slugMap object from the TypeScript file
    const slugMapMatch = configContent.match(/export const slugMap[^=]*=\s*{([^}]*)}/s);
    if (!slugMapMatch) {
      console.warn("Could not find slugMap in config.ts");
      return [];
    }

    // Extract the keys (slugs) from the slugMap
    const slugMapContent = slugMapMatch[1];
    const slugMatches = slugMapContent.match(/"([^"]+)":/g);

    if (!slugMatches) {
      console.warn("Could not extract slugs from slugMap");
      return [];
    }

    return slugMatches.map((match) => match.replace(/[":]/g, ""));
  } catch (error) {
    console.error("Error reading config.ts:", error);
    return [];
  }
}

function generateSiteMap() {
  const blogSlugs = getAllBlogPostSlugs();
  const additionalSlugs = getAdditionalSlugs();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
   <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
     <url>
       <loc>https://GovClerkMinutes.com</loc>
     </url>
     ${additionalSlugs
       .map((slug) => {
         return `
     <url>
       <loc>https://GovClerkMinutes.com/${slug}</loc>
     </url>`;
       })
       .join("")}
     ${blogSlugs
       .map((slug) => {
         return `
     <url>
       <loc>https://GovClerkMinutes.com/blog/${slug}</loc>
     </url>`;
       })
       .join("")}
   </urlset>
 `;

  fs.writeFileSync(SITEMAP_PATH, xml);

  const cdXml = `<?xml version="1.0" encoding="UTF-8"?>
   <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
     <url>
       <loc>https://GovClerk.com</loc>
     </url>
   </urlset>
 `;

  fs.writeFileSync(CD_SITEMAP_PATH, cdXml);
}

generateSiteMap();
