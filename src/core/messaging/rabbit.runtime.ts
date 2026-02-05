// src/core/messaging/rabbit.runtime.ts
// Minimal RabbitMQ wrapper (robust against type/version quirks)

import amqp from "amqplib";

export const EXCHANGE = "gen.events";
export const EXCHANGE_TYPE = "topic";
export const RK_SUBMISSION_CREATED = "submission.created";

const RABBIT_URL = process.env.RABBIT_URL ?? "amqp://guest:guest@localhost:5672";


let conn: any = null;
let chan: any = null;

async function ensureChannel(): Promise<any> {
  if (chan) return chan;

  const c = await amqp.connect(RABBIT_URL);      // Connection
  const ch = await c.createChannel();            // Channel

  await ch.assertExchange(EXCHANGE, EXCHANGE_TYPE, { durable: true });

  c.on("error", (e: any) => console.error("[rabbit] conn error", e));
  ch.on("error", (e: any) => console.error("[rabbit] channel error", e));

  conn = c;
  chan = ch;
  return ch;
}

export async function publishEvent(routingKey: string, body: any, props: any = {}) {
  const ch = await ensureChannel();
  const payload = Buffer.from(JSON.stringify(body));

  const ok = ch.publish(EXCHANGE, routingKey, payload, {
    persistent: true,
    contentType: "application/json",
    messageId: body?.id,
    headers: {
      idempotencyKey: body?.idempotencyKey,
      correlationId: body?.correlationId,
      specVersion: body?.specVersion,
      eventVersion: body?.eventVersion,
    },
    ...props,
  });

  if (!ok) console.warn("[rabbit] publish returned false (highWaterMark hit)");
}

export default {
  publishEvent,
  EXCHANGE,
  EXCHANGE_TYPE,
  RK_SUBMISSION_CREATED,
};
