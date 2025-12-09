import { NextResponse } from "next/server";

type BullhornEvent = {
  eventId: string;
  entityName: string;
  entityId: string | number;
  eventType: string;
  updatedProperties?: string[];
  timestamp?: string | number;
};

type BullhornWebhookPayload = {
  subscriptionId: string;
  events: BullhornEvent[];
};

const processedEventIds = new Set<string>();

function validateEvent(event: BullhornEvent): void {
  if (!event || typeof event !== "object") {
    throw new Error("Each event must be an object");
  }

  if (!event.eventId || typeof event.eventId !== "string") {
    throw new Error("eventId is required for each event");
  }

  if (!event.entityName || typeof event.entityName !== "string") {
    throw new Error("entityName is required for each event");
  }

  if (event.entityId === undefined || event.entityId === null) {
    throw new Error("entityId is required for each event");
  }

  if (!event.eventType || typeof event.eventType !== "string") {
    throw new Error("eventType is required for each event");
  }

  if (
    event.updatedProperties !== undefined &&
    !Array.isArray(event.updatedProperties)
  ) {
    throw new Error("updatedProperties must be an array when provided");
  }
}

function validatePayload(body: unknown): asserts body is BullhornWebhookPayload {
  if (!body || typeof body !== "object") {
    throw new Error("Payload must be an object");
  }

  const candidate = body as Partial<BullhornWebhookPayload>;

  if (!candidate.subscriptionId || typeof candidate.subscriptionId !== "string") {
    throw new Error("subscriptionId is required and must be a string");
  }

  if (!candidate.events || !Array.isArray(candidate.events)) {
    throw new Error("events must be an array");
  }

  candidate.events.forEach(validateEvent);
}

function verifySignature(request: Request) {
  const expectedSignature = process.env.BULLHORN_WEBHOOK_SECRET;

  if (!expectedSignature) return;

  const providedSignature = request.headers.get("x-bullhorn-signature");

  if (providedSignature !== expectedSignature) {
    throw new Error("Signature mismatch");
  }
}

function recordEventId(eventId: string): boolean {
  if (processedEventIds.has(eventId)) {
    return false;
  }

  processedEventIds.add(eventId);
  return true;
}

export function resetProcessedEventIds() {
  processedEventIds.clear();
}

export function GET() {
  return NextResponse.json({ status: "ok" });
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "GET,POST,OPTIONS",
    },
  });
}

export async function POST(request: Request) {
  try {
    verifySignature(request);
  } catch (error) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: BullhornWebhookPayload;

  try {
    payload = await request.json();
    validatePayload(payload);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  const counts = {
    totalEvents: payload.events.length,
    processed: 0,
    duplicates: 0,
    noChange: 0,
  };

  const processedEvents: BullhornEvent[] = [];

  for (const event of payload.events) {
    if (!recordEventId(event.eventId)) {
      counts.duplicates += 1;
      continue;
    }

    const hasChanges = Array.isArray(event.updatedProperties)
      ? event.updatedProperties.length > 0
      : false;

    if (!hasChanges) {
      counts.noChange += 1;
      continue;
    }

    processedEvents.push(event);
  }

  counts.processed = processedEvents.length;

  return NextResponse.json(
    {
      subscriptionId: payload.subscriptionId,
      received: counts.totalEvents,
      processed: counts.processed,
      duplicates: counts.duplicates,
      ignoredWithoutChanges: counts.noChange,
      events: processedEvents,
    },
    { status: 202 },
  );
}
