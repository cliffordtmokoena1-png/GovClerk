/*
HeadshotPro:
word counts,TOC_sections
830,3
1200,5
770,4
1100,4

BannerBear:
word counts,TOC_sections
1200,4
1000,4
1200,3
1900,6


- All stock images from unsplash.com
- Images are hosted statically
- Links to related articles
- Frequency of posting: once weekly

Ideas for blog posts:
- Product tutorial
- "The Future of Meetings: How AI is Changing the Way We Record and Transcribe"
- "Why Transcribed Meeting Minutes are Essential for Every Business"
- "From Speech to Text: How AI Transcription Works"
- "Top 5 Benefits of Using AI for Meeting Transcriptions"
- "Guide to Choosing the Best AI Meeting Transcription Service"
- "How AI is Improving Accuracy in Meeting Transcriptions"
- "Maximizing Your Meeting Productivity with AI Transcription"
- "Understanding the Role of AI in Transforming Meeting Minutes"
- "Eliminate Miscommunication: Ensure Accurate Meeting Records with AI"
- "AI Transcription vs. Human Transcription: A Comparative Study"
*/

import { assertString } from "@/utils/assert";
import { BlogPost, getAllBlogPostSlugs, getBlogPost } from "@/blog/blogUtils";
import BlogArticleWrapper from "@/components/blog/BlogArticleWrapper";
import { useState } from "react";

type Props = BlogPost;

export async function getStaticPaths() {
  const paths = getAllBlogPostSlugs().map((slug) => ({
    params: { slug },
  }));
  return {
    paths,
    fallback: false,
  };
}

export async function getStaticProps({ params }: any) {
  const postData = getBlogPost(assertString(params?.slug));
  return {
    props: {
      ...postData,
    },
  };
}

const Blog = (props: Props) => {
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  return (
    <BlogArticleWrapper
      {...props}
      emailSubmitted={emailSubmitted}
      onEmailSubmitted={() => setEmailSubmitted(true)}
    />
  );
};

export default Blog;
