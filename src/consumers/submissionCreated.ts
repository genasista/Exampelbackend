// src/consumers/submissionCreated.ts
import amqp from "amqplib";
import { EXCHANGE, EXCHANGE_TYPE, RK_SUBMISSION_CREATED } from "@core/messaging/rabbit.runtime";

const RABBIT_URL = process.env.RABBIT_URL ?? "amqp://guest:guest@localhost:5672";
const QUEUE = "q.submission.created";

async function main() {
  const conn = await amqp.connect(RABBIT_URL);
  const ch = await conn.createChannel();

  await ch.assertExchange(EXCHANGE, EXCHANGE_TYPE, { durable: true });
  await ch.assertQueue(QUEUE, { durable: true });
  await ch.bindQueue(QUEUE, EXCHANGE, RK_SUBMISSION_CREATED);
  ch.prefetch(10);

  console.log(`[consumer] waiting on ${QUEUE}`);

  await ch.consume(
    QUEUE,
    (msg) => {
      if (!msg) return;
      try {
        const evt = JSON.parse(msg.content.toString("utf8"));
        const headers = msg.properties.headers ?? {};
        console.log("[consumer] got", {
          messageId: msg.properties.messageId,
          idempotencyKey: headers.idempotencyKey,
          type: evt?.type,
          payload: evt?.payload,
        });
        ch.ack(msg);
      } catch (e) {
        console.error("[consumer] error", e);
        ch.nack(msg, false, false); // dead-letter in real system
      }
    },
    { noAck: false }
  );

  process.on("SIGINT", async () => {
    try { await ch.close(); } catch {}
    try { await conn.close(); } catch {}
    process.exit(0);
  });
}

main().catch((e) => {
  console.error("[consumer] fatal", e);
  process.exit(1);
});
