import Head from "next/head";
import Script from "next/script";

type Props = {
  noindex?: boolean;
  title?: string;
  description?: string;
  image?: string;
  canonical?: string;
  keywords?: string;
};

export default function MgHead({ noindex, title, description, image, canonical, keywords }: Props) {
  return (
    <>
      <Head>
        <title>{title || "GovClerkMinutes: Meeting Minutes with AI"}</title>
        {noindex && <meta name="robots" content="noindex" />}
        <meta charSet="UTF-8" />

        <link rel="icon" href="/icon.svg?v=1" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon-square.png" />
        <link rel="manifest" href="/manifest.json" />
        {canonical && <link rel="canonical" href={canonical} />}

        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta
          name="description"
          content={
            description ||
            "Automatically generate meeting minutes from your audio or video recordings. Keep track of important decisions, tasks, and topics discussed during your meetings."
          }
        />
        <meta
          name="keywords"
          content={
            keywords ||
            "Meeting, Minutes, Generator, Transcription, Audio, Video, Productivity, Efficiency, AI"
          }
        />
        <meta name="author" content="GovClerkMinutes.com" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://GovClerkMinutes.com/" />
        <meta
          property="og:title"
          content={title || "GovClerkMinutes: Professional Meeting Minutes Generated with AI"}
        />
        <meta
          property="og:description"
          content={
            description ||
            "Automatically generate meeting minutes from your audio or video recordings. Keep track of important decisions, tasks, and topics discussed during your meetings."
          }
        />
        {/* TODO: Use a better image, this will appear in social media feeds. */}
        <meta property="og:image" content={image || "https://GovClerkMinutes.com/thumbnail.png"} />

        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://GovClerkMinutes.com" />
        <meta property="twitter:creator" content="@johnislarry" />
        <meta
          property="twitter:title"
          content={title || "GovClerkMinutes: Professional Meeting Minutes Generated with AI"}
        />
        <meta
          property="twitter:description"
          content={
            description ||
            "Automatically generate meeting minutes from your audio or video recordings. Keep track of important decisions, tasks, and topics discussed during your meetings."
          }
        />
        {/* TODO: Use a better image, this will appear in social media feeds. */}
        <meta
          property="twitter:image"
          content={image || "https://GovClerkMinutes.com/thumbnail.png"}
        />
      </Head>

      {/* Google tag (gtag.js) */}
      <Script
        async
        src="https://www.googletagmanager.com/gtag/js?id=AW-17712526206"
        strategy="afterInteractive"
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'AW-17712526206', {
          allow_enhanced_conversions: true
        });
        `}
      </Script>
    </>
  );
}
