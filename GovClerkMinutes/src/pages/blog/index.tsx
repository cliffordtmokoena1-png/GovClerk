import { BlogPost, getAllBlogPostSlugs, getBlogPost } from "@/blog/blogUtils";
import BlogHomeWrapper from "@/components/blog/BlogHomeWrapper";

type Props = {
  blogPosts: BlogPost[];
};

export async function getStaticProps() {
  const slugs = getAllBlogPostSlugs();
  const blogPosts = slugs.map((slug) => getBlogPost(slug));
  return {
    props: {
      blogPosts,
    },
  };
}

const BlogHome = ({ blogPosts }: Props) => {
  return <BlogHomeWrapper blogPosts={blogPosts} />;
};

export default BlogHome;
