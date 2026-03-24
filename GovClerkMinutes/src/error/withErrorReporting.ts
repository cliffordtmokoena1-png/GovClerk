import { capture } from "@/utils/posthog";
import { NextApiRequest, NextApiResponse } from "next/types";
import { getAuth } from "@clerk/nextjs/server";
import { NextFetchEvent, NextMiddleware, NextRequest } from "next/server";
import { waitUntil } from "@vercel/functions";
import { GetServerSideProps, GetServerSidePropsContext, GetServerSidePropsResult } from "next";
import { NextMiddlewareResult } from "next/dist/server/web/types";

type ServerlessHandler = (req: NextApiRequest, res: NextApiResponse) => void;
type EdgeHandler = (req: NextRequest) => Promise<Response>;
type Handler = ServerlessHandler | EdgeHandler;

const ANONYMOUS_POSTHOG_TOPLEVEL_ID = "anonymous_posthog_toplevel_error_userid";

function isServerlessHandler(handler: Handler): handler is ServerlessHandler {
  return (handler as ServerlessHandler).length === 2;
}

async function handleBadStatusCode(code: number, req: NextApiRequest | NextRequest) {
  if (code < 400) {
    return;
  }

  let userId: string | null | undefined;
  try {
    const auth = await getAuth(req);
    userId = auth.userId;
  } catch (e) {
    console.error("Error getting auth:", e);
  }

  try {
    await capture(
      "api_toplevel_bad_status_code",
      {
        // This is 'xurl' because of a bug in posthog where 'url' is silently dropped.
        xurl: req.url,
        code,
      },
      userId ?? ANONYMOUS_POSTHOG_TOPLEVEL_ID
    );
  } catch (e) {
    // Treat this error as non-fatal so logging doesn't take down the API function.
    console.error("Error capturing error:", e);
  }
}

async function handleError(error: any, req: NextApiRequest | NextRequest) {
  console.error(error);

  const errorMessage = error?.message || error.toString();
  const errorStack = error?.stack || "No stack trace available";

  let userId: string | null | undefined;
  try {
    const auth = await getAuth(req);
    userId = auth.userId;
  } catch (e) {
    console.error("Error getting auth:", e);
  }

  try {
    await capture(
      "api_toplevel_error",
      {
        // This is 'xurl' because of a bug in posthog where 'url' is silently dropped.
        xurl: req.url,
        errorMessage,
        errorStack,
      },
      userId ?? ANONYMOUS_POSTHOG_TOPLEVEL_ID
    );
  } catch (e) {
    // Treat this error as non-fatal so logging doesn't take down the API function.
    console.error("Error capturing error:", e);
  }
}

export default function withErrorReporting(handler: Handler): Handler {
  if (isServerlessHandler(handler)) {
    return async (req: NextApiRequest, res: NextApiResponse) => {
      try {
        await handler(req, res);
      } catch (error) {
        waitUntil(handleError(error, req));
        if (!res.headersSent) {
          const message = error instanceof Error ? error.message : "Internal server error";
          res.status(500).json({ error: message });
        } else {
          throw error;
        }
      } finally {
        waitUntil(handleBadStatusCode(res.statusCode, req));
      }
    };
  } else {
    return async (req: NextRequest) => {
      try {
        const res = await handler(req);
        waitUntil(handleBadStatusCode(res.status, req));
        return res;
      } catch (error) {
        waitUntil(handleError(error, req));
        const message = error instanceof Error ? error.message : "Internal server error";
        return new Response(JSON.stringify({ error: message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    };
  }
}

/**
 * Wraps a getServerSideProps function to catch and log any exceptions that occur.
 *
 * @param gssp - The original getServerSideProps function to wrap.
 * @returns A new getServerSideProps function with error handling.
 */
export function withGsspErrorHandling<P extends { [key: string]: any }>(
  gssp: GetServerSideProps<P>
): GetServerSideProps<P> {
  return async (context: GetServerSidePropsContext): Promise<GetServerSidePropsResult<P>> => {
    try {
      return await gssp(context);
    } catch (error) {
      waitUntil(handleError(error, context.req as any));
      throw error;
    }
  };
}

export function withMiddlewareErrorHandling(
  middleware: (
    request: NextRequest,
    event: NextFetchEvent
  ) => NextMiddlewareResult | Promise<NextMiddlewareResult>
): NextMiddleware {
  return async (request: NextRequest, event: NextFetchEvent) => {
    try {
      const result = await middleware(request, event);
      if (result instanceof Response) {
        event.waitUntil(handleBadStatusCode(result.status, request));
      }
      return result;
    } catch (error) {
      event.waitUntil(handleError(error, request));
      throw error;
    }
  };
}
