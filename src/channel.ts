export interface Subscriber {
  id: string;
  controller: ReadableStreamDefaultController;
}

export class Channel {
  state: DurableObjectState;
  subscribers: Map<string, Subscriber> = new Map();

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(req: Request) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    if (pathname === "/stream") {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start: (controller) => {
          const id = crypto.randomUUID();

          this.subscribers.set(id, { id, controller });

          const ping = setInterval(() => {
            const pingData = JSON.stringify({ type: "ping" });

            controller.enqueue(encoder.encode(`data: ${pingData}\n\n`));
          }, 15_000);

          req.signal.addEventListener("abort", () => {
            clearInterval(ping);

            this.subscribers.delete(id);
          });
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Broadcast messages
    if (pathname === "/broadcast" && req.method === "POST") {
      const data = await req.json().catch(() => ({}));
      const message = JSON.stringify({
        type: "webhook",
        data,
        timestamp: Date.now(),
      });

      const encoder = new TextEncoder();

      for (const sub of this.subscribers.values()) {
        try {
          sub.controller.enqueue(encoder.encode(`data: ${message}\n\n`));
        } catch (e) {
          // subscriber disconnected
          this.subscribers.delete(sub.id);
        }
      }

      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    return new Response("Not found", { status: 404 });
  }
}
