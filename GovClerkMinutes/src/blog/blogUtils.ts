import fs from "fs";
import matter from "gray-matter";
import path from "path";

const POSTS_DIR = "src/blog/posts";

export interface BlogPostMetadata {
  title: string;
  description: string;
  author: string;
  date: string;
  slug: string;
  imgUri: string;
}

export interface BlogPost {
  content: string;
  data: BlogPostMetadata;
}

export function getAllBlogPostSlugs(): string[] {
  const slugs = fs.readdirSync(POSTS_DIR);
  return slugs.map((slug) => slug.replace(".md", ""));
}

export function getBlogPost(slug: string): BlogPost {
  const fullPath = path.join(POSTS_DIR, `${slug}.md`);
  const fileContents = fs.readFileSync(fullPath, "utf8");
  const blogPost: BlogPost = matter(fileContents) as any;
  // Pull off the fields we need, there are some from matter that are unserializable.
  return {
    content: blogPost.content,
    data: {
      ...blogPost.data,
      slug,
    },
  };
}
