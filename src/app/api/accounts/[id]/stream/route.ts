import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  const responseStream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue(`data: Connected to SSE stream for account ${id}\n\n`);

      // Set up a periodic ping to keep connection alive
      const interval = setInterval(() => {
        try {
          // Send ping event
          controller.enqueue("event: ping\ndata: {}\n\n");
        } catch (e) {
          clearInterval(interval);
        }
      }, 10000);

      // Clean up connection on client disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch (e) {}
      });
    },
  });

  return new Response(responseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "Content-Encoding": "none",
    },
  });
}
export const dynamic = "force-dynamic";
