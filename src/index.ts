export { Channel } from "./channel";

import { Hono } from "hono";
import { cors } from "hono/cors";
import { Env } from "./env";

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors());

app.get("/", (c) => c.text("🪝 Selfhook Server is running."));

app.post("/channels/:id", async (c) => {
  const channelId = c.req.param("id");

  // Get Durable Object stub
  const id = c.env.CHANNEL.idFromName(channelId);
  const stub = c.env.CHANNEL.get(id);

  const res = await stub.fetch(new URL("/broadcast", c.req.url), {
    method: "POST",
    body: JSON.stringify(await c.req.json().catch(() => ({}))),
    headers: { "Content-Type": "application/json" },
  });

  const data = await res.json();
  return c.json(data);
});

app.get("/channels/:id/stream", async (c) => {
  const channelId = c.req.param("id");

  const id = c.env.CHANNEL.idFromName(channelId);
  const stub = c.env.CHANNEL.get(id);

  return stub.fetch(new URL("/stream", c.req.url));
});

export default app;
