import { GetServerSideProps } from "next";
import { useUser, useSignIn } from "@clerk/nextjs";
import { useEffect } from "react";
import { Flex, Spinner, Text } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { safeCapture } from "@/utils/safePosthog";
import isMobile from "../../utils/isMobile";
import getUserIdFromToken from "@/auth/getUserIdFromToken";
import { createSignInToken } from "@/utils/clerk";
import { withGsspErrorHandling } from "@/error/withErrorReporting";
import { serialize } from "cookie";
import { connect } from "@planetscale/database";
import MgHead from "@/components/MgHead";
import { getSiteFromHeaders } from "@/utils/site";

type Props = {
  signInToken: string;
  isMobile: boolean;
};

async function getUtmCookieValue(userId: string): Promise<string | undefined> {
  const conn = connect({
    host: process.env.PLANETSCALE_DB_HOST!,
    username: process.env.PLANETSCALE_DB_USERNAME!,
    password: process.env.PLANETSCALE_DB_PASSWORD!,
  });

  const rows = await conn
    .execute("SELECT utm_params FROM gc_meta_conversions WHERE user_id = ?;", [userId])
    .then((res) => res.rows);

  if (rows.length === 0) {
    return undefined;
  }

  return serialize("gc_utm_params", JSON.stringify(rows[0].utm_params ?? {}), {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production",
  });
}

export const getServerSideProps: GetServerSideProps = withGsspErrorHandling(async (context) => {
  const { params } = context;
  let token = params?.token;

  if (typeof token !== "string") {
    return {
      redirect: {
        destination: "/sign-in",
        permanent: false,
      },
    };
  }

  const userId = await getUserIdFromToken(token);
  if (userId == null) {
    return {
      redirect: {
        destination: "/sign-in",
        permanent: false,
      },
    };
  }

  const site = getSiteFromHeaders(context.req.headers);
  const [signInToken, utmCookieValue] = await Promise.all([
    createSignInToken(userId, site),
    getUtmCookieValue(userId),
  ]);

  if (signInToken == null) {
    return {
      redirect: {
        destination: "/sign-in",
        permanent: false,
      },
    };
  }

  if (utmCookieValue != null) {
    context.res.setHeader("Set-Cookie", utmCookieValue);
  }

  return {
    props: {
      signInToken,
      isMobile: isMobile(context.req.headers),
    },
  };
});

export default function AcceptToken({ signInToken, isMobile }: Props) {
  const router = useRouter();
  const { signIn, setActive } = useSignIn();
  const { isLoaded, isSignedIn } = useUser();
  const { transcript_id } = router.query;

  useEffect(() => {
    if (!signIn || !isLoaded) {
      return;
    }

    if (isSignedIn) {
      const uri = transcript_id ? `/dashboard/${transcript_id}` : "/dashboard";
      router.push(uri);

      safeCapture("user_magic_login_success", {
        cookie: document.cookie,
      });
    } else {
      try {
        signIn
          .create({
            strategy: "ticket",
            ticket: signInToken,
          })
          .then((res) =>
            setActive({
              session: res.createdSessionId,
            })
          );
      } catch (err) {
        const errorInfo = err instanceof Error ? { message: err.message, stack: err.stack } : err;
        safeCapture("user_magic_login_set_active_error", {
          err: JSON.stringify(errorInfo),
        });
      }
    }
  }, [isLoaded, isMobile, isSignedIn, router, setActive, signIn, signInToken, transcript_id]);

  // Fallback after 30 seconds in case we never get a legit User.
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      router.push("/sign-in");
    }, 30000);

    return () => clearTimeout(timeoutId);
  }, [router]);

  return (
    <>
      <MgHead title="Signing you in..." noindex />
      <Flex
        flexDir="column"
        w="100dvw"
        h="100dvh"
        alignItems="center"
        justifyContent="center"
        gap={4}
      >
        <Text>Signing you in...</Text>
        <Spinner />
      </Flex>
    </>
  );
}
