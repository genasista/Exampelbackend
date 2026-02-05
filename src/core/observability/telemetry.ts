type EventProps = Record<string, any>;
type LogItem = { ts: string; name: string; properties: EventProps };

const BUF_CAP = 500;
const buf: LogItem[] = [];

function pushBuf(item: LogItem) {
    buf.push(item);
    if (buf.length > BUF_CAP) buf.shift();
  }
  
  export function trackEvent(name: string, properties: EventProps = {}) {
    const record: LogItem = { ts: new Date().toISOString(), name, properties };
    console.log(`[event] ${JSON.stringify(record)}`);
    pushBuf(record);
  }

  export function getBufferedEvents() {
    return buf.slice().reverse();
  }