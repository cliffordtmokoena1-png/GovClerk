import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { AnnouncementProvider } from "@/contexts/AnnouncementContext";
import { useCallEngine } from "@/admin/whatsapp/hooks/useCallEngine";
import CallBox from "@/components/admin/whatsapp/CallBox";
import type { IncomingMessage } from "@/admin/websocket/types";
import type { WhatsappWebhook } from "@/admin/whatsapp/types";

// ---- Module mocks ----
// The page imports these at module scope but only uses them in getServerSideProps.
jest.mock("@/wati", () => ({ getMessageTemplates: jest.fn().mockResolvedValue([]) }));
jest.mock("@/admin/whatsapp/api", () => ({
  getTemplates: jest.fn().mockResolvedValue({ templates: [] }),
}));
// Push subscription UI isn't relevant for this test
jest.mock("@/components/AdminPushSubscription", () => () => null);
// Avoid pulling Clerk server via error wrappers
jest.mock("@/error/withErrorReporting", () => ({
  __esModule: true,
  default: (fn: any) => fn,
  withGsspErrorHandling: (fn: any) => fn,
  withMiddlewareErrorHandling: (fn: any) => fn,
}));
jest.mock("@clerk/nextjs/server", () => ({}));
// Provide a minimal next/router for AnnouncementProvider
jest.mock("next/router", () => ({
  useRouter: () => ({
    events: { on: jest.fn(), off: jest.fn() },
    push: jest.fn(),
    pathname: "/",
    query: {},
    asPath: "/",
  }),
}));

// Mock useWebSocket to capture subscribers and let tests emit messages
let wsHandlers: {
  onMessage?: (m: IncomingMessage) => void;
  onConnect?: () => void | (() => void);
}[] = [];
jest.mock("@/admin/hooks/useWebSocket", () => ({
  useWebSocket: () => ({
    status: "open",
    error: null,
    send: jest.fn(),
    subscribe: (params: any) => {
      wsHandlers.push(params);
      // Simulate immediate connect callback
      try {
        params.onConnect?.();
      } catch {}
      return () => {
        wsHandlers = wsHandlers.filter((p) => p !== params);
      };
    },
  }),
}));

// ---- Minimal browser API mocks ----
const originalRAF = global.requestAnimationFrame;
const originalCAFn = global.cancelAnimationFrame;

beforeAll(() => {
  // matchMedia for Chakra breakpoints
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: query.includes("(min-width: 62em)") ? true : false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }),
  });

  // Media element stubs
  // @ts-ignore
  window.HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
  // @ts-ignore
  window.HTMLMediaElement.prototype.pause = jest.fn();
  // @ts-ignore
  window.HTMLMediaElement.prototype.load = jest.fn();
  // @ts-ignore
  (window.HTMLMediaElement.prototype as any).setSinkId = jest.fn().mockResolvedValue(undefined);

  // requestAnimationFrame for the mic meter loop
  // @ts-ignore
  global.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(Date.now()), 5) as unknown as number;
  // @ts-ignore
  global.cancelAnimationFrame = (id: number) =>
    clearTimeout(id as unknown as ReturnType<typeof setTimeout>);

  // navigator.mediaDevices mocks
  const fakeTrack = () =>
    ({
      kind: "audio",
      stop: jest.fn(),
      enabled: true,
      id: Math.random().toString(36).slice(2),
      label: "Mic",
    }) as any;

  const fakeStream = () =>
    ({
      getAudioTracks: () => [fakeTrack()],
      getTracks: () => [fakeTrack()],
      addTrack: jest.fn(),
    }) as any;

  Object.defineProperty(navigator, "mediaDevices", {
    value: {
      enumerateDevices: jest.fn().mockResolvedValue([
        { deviceId: "mic-1", kind: "audioinput", label: "Mic 1" },
        { deviceId: "spk-1", kind: "audiooutput", label: "Speaker 1" },
      ]),
      getUserMedia: jest.fn().mockResolvedValue(fakeStream()),
    },
    configurable: true,
  });

  // AudioContext mocks used by meter & silent track
  class FakeAnalyser {
    fftSize = 2048;
    getByteTimeDomainData(arr: Uint8Array) {
      // Fill with center values for low RMS
      arr.fill(128);
    }
  }
  class FakeMediaStreamDestination {
    stream = { getAudioTracks: () => [{ kind: "audio", stop: jest.fn() }] } as any;
  }
  class FakeGain {
    gain = { value: 0 };
    connect = jest.fn();
  }
  class FakeOscillator {
    connect = jest.fn();
    start = jest.fn();
  }
  class FakeMediaStreamSource {
    connect = jest.fn();
  }
  class FakeAudioContext {
    createOscillator() {
      return new FakeOscillator();
    }
    createGain() {
      return new FakeGain();
    }
    createMediaStreamDestination() {
      return new FakeMediaStreamDestination();
    }
    createAnalyser() {
      return new FakeAnalyser();
    }
    createMediaStreamSource(_s: any) {
      return new FakeMediaStreamSource();
    }
  }
  // @ts-ignore
  (window as any).AudioContext = FakeAudioContext;
  // @ts-ignore
  (window as any).webkitAudioContext = FakeAudioContext;

  // RTCPeerConnection mock
  class FakeSender {
    _track: any = null;
    replaceTrack = jest.fn(async (t: any) => {
      this._track = t;
    });
    setStreams = jest.fn();
  }
  class FakeTransceiver {
    sender = new FakeSender();
    receiver: any = { track: { kind: "audio" } };
    mid = "audio";
    setDirection = jest.fn();
  }
  class FakeRTCPeerConnection {
    connectionState: RTCPeerConnectionState = "new";
    iceConnectionState: RTCIceConnectionState = "new";
    iceGatheringState: RTCIceGatheringState = "complete";
    localDescription: any = null;
    remoteDescription: any = null;

    ontrack: any = null;
    onconnectionstatechange: any = null;
    oniceconnectionstatechange: any = null;
    onsignalingstatechange: any = null;
    onicecandidateerror: any = null;
    onicegatheringstatechange: any = null;

    _trans = [new FakeTransceiver()];

    constructor(_cfg?: RTCConfiguration) {}

    addEventListener(_evt: string, _cb: any) {}

    addTransceiver(_kind: any, _opts?: any) {
      return this._trans[0];
    }
    getTransceivers() {
      return this._trans;
    }

    getSenders() {
      return [this._trans[0].sender];
    }
    getReceivers() {
      return [];
    }

    async createAnswer() {
      return { type: "answer", sdp: "v=0\r\n...answer" } as any;
    }
    async createOffer() {
      return { type: "offer", sdp: "v=0\r\n...offer" } as any;
    }

    async setLocalDescription(desc: any) {
      this.localDescription = desc;
      // If remote already set, mark connected
      if (this.remoteDescription && this.connectionState !== "connected") {
        this.connectionState = "connected";
        this.onconnectionstatechange?.();
      }
    }

    async setRemoteDescription(desc: any) {
      this.remoteDescription = desc;
      // For simplicity, flip to connected when both descriptions exist or when we get an answer
      const hasLocal = Boolean(this.localDescription);
      const isAnswer = desc?.type === "answer";
      if (hasLocal || isAnswer) {
        if (this.connectionState !== "connected") {
          this.connectionState = "connected";
          this.onconnectionstatechange?.();
        }
      }
    }

    async getStats() {
      return { forEach: (_cb: any) => {} } as any;
    }
    addTrack(_track: any, _stream: any) {
      // no-op
    }
    close() {
      this.connectionState = "closed";
    }
  }
  // @ts-ignore
  (window as any).RTCPeerConnection = FakeRTCPeerConnection;
  // Minimal MediaStream polyfill used by useCallEngine
  class FakeMediaStream {
    private _tracks: any[] = [];
    addTrack(t: any) {
      this._tracks.push(t);
    }
    getTracks() {
      return this._tracks.slice();
    }
    getAudioTracks() {
      return this._tracks.filter((t) => t.kind === "audio");
    }
  }
  // @ts-ignore
  (window as any).MediaStream = FakeMediaStream;
});

afterAll(() => {
  global.requestAnimationFrame = originalRAF;
  global.cancelAnimationFrame = originalCAFn;
});

let fetchSpy: jest.SpyInstance | null = null;

beforeEach(() => {
  wsHandlers = [];
  jest.useFakeTimers();
  if (!(globalThis as any).fetch) {
    (globalThis as any).fetch = (() => Promise.resolve(new Response())) as any;
  }
  fetchSpy = jest.spyOn(globalThis as any, "fetch").mockImplementation(async (...args: any[]) => {
    const input = args[0] as RequestInfo | URL;
    const init = args[1] as RequestInit | undefined;
    const url = typeof input === "string" ? input : (input as URL).toString();
    // Conversations list (SWR)
    if (url.endsWith("/api/admin/get-whatsapp-conversations")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ conversations: [], nextCursor: null, limit: 30, total: 0 }),
        text: async () =>
          JSON.stringify({ conversations: [], nextCursor: null, limit: 30, total: 0 }),
      } as any;
    }
    // TURN config
    if (url.endsWith("/api/admin/turn")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }] }),
        text: async () =>
          JSON.stringify({ iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }] }),
      } as any;
    }
    // Call control
    if (url.endsWith("/api/admin/whatsapp/call")) {
      const body = init?.body ? JSON.parse(init!.body as string) : {};
      const action = body?.action;
      if (action === "connect") {
        // Return call id
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: "wacid.connect.1", callId: "wacid.connect.1" }),
          text: async () => JSON.stringify({ id: "wacid.connect.1", callId: "wacid.connect.1" }),
        } as any;
      }
      // accept/reject/terminate succeed
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
        text: async () => JSON.stringify({ ok: true }),
      } as any;
    }

    // Default
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
      text: async () => JSON.stringify({ ok: true }),
    } as any;
  });
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  fetchSpy?.mockRestore();
  fetchSpy = null;
});

function emitWS(msg: IncomingMessage) {
  for (const h of wsHandlers) {
    h.onMessage?.(msg);
  }
}

function Harness() {
  const engine = useCallEngine({ debug: false, acceptTimeoutMs: 25000 });
  const [incomingCall, setIncomingCall] = React.useState<WhatsappWebhook.CallItem | null>(null);
  const [outboundCall, setOutboundCall] = React.useState<WhatsappWebhook.CallItem | null>(null);
  const [outboundStatus, setOutboundStatus] =
    React.useState<WhatsappWebhook.CallStatusValue | null>(null);
  const currentCallIdRef = React.useRef<string | null>(null);

  // Subscribe to mocked websocket and route messages similar to the page
  const { subscribe } = require("@/admin/hooks/useWebSocket").useWebSocket();
  React.useEffect(() => {
    return subscribe({
      onMessage: (msg: IncomingMessage) => {
        if (msg.kind !== "call") {
          return;
        }
        const kind = msg.data.kind;
        const value = msg.data.value as any;
        if (kind === "calls") {
          const first = (value?.calls ?? [])[0] as WhatsappWebhook.CallItem | undefined;
          if (!first) {
            return;
          }
          if (first.event === "connect" && first.session?.sdp) {
            if (first.direction === "USER_INITIATED") {
              setIncomingCall(first);
              try {
                engine.bind(first.id);
                engine.preAccept(first.session.sdp, first.to);
              } catch {}
            } else if (first.direction === "BUSINESS_INITIATED") {
              try {
                setOutboundCall(first);
                currentCallIdRef.current = first.id;
                engine.bind(first.id);
                engine.applyAnswer({
                  callId: first.id,
                  phoneNumberId: first.from,
                  answerSdp: first.session.sdp,
                });
              } catch {}
            }
          } else if (first.event === "terminate") {
            engine.terminate().finally(() => {
              setIncomingCall(null);
              setOutboundCall(null);
              setOutboundStatus(null);
              currentCallIdRef.current = null;
            });
          }
        } else if (kind === "statuses") {
          const statuses = (value?.statuses ?? []) as WhatsappWebhook.CallStatusItem[];
          for (const s of statuses) {
            const match = currentCallIdRef.current && s.id === currentCallIdRef.current;
            if (match) {
              setOutboundStatus(s.status);
              if (s.status === "REJECTED") {
                engine.terminate().finally(() => {
                  setIncomingCall(null);
                  setOutboundCall(null);
                  setOutboundStatus(null);
                  currentCallIdRef.current = null;
                });
              }
            }
          }
        }
      },
    });
  }, [engine, subscribe]);

  const isOutbound = Boolean(outboundCall);

  return (
    <>
      {(incomingCall || outboundCall) && (
        <CallBox
          call={incomingCall ?? outboundCall ?? undefined}
          engineState={engine.state}
          isOutbound={isOutbound}
          status={outboundStatus ?? undefined}
          setMicDevice={engine.setInputDevice}
          onAccept={() => engine.accept()}
          onReject={() => {
            const doEnd = Boolean(outboundCall);
            const fn = doEnd ? engine.terminate : engine.reject;
            fn().finally(() => {
              setIncomingCall(null);
              setOutboundCall(null);
              setOutboundStatus(null);
              currentCallIdRef.current = null;
            });
          }}
          onDismiss={() => {
            engine.endLocal();
            setIncomingCall(null);
            setOutboundCall(null);
            setOutboundStatus(null);
            currentCallIdRef.current = null;
          }}
        />
      )}
      <audio id="mg-wa-call-audio" autoPlay playsInline style={{ display: "none" }} />
    </>
  );
}

function renderPage() {
  return render(
    <ChakraProvider>
      <AnnouncementProvider>
        <Harness />
      </AnnouncementProvider>
    </ChakraProvider>
  );
}

function makeInboundConnect(): IncomingMessage {
  const call: WhatsappWebhook.CallItem = {
    id: "wacid.in.1",
    from: "15551234567",
    to: "18005550100",
    event: "connect",
    timestamp: String(Math.floor(Date.now() / 1000)),
    direction: "USER_INITIATED",
    session: { sdp_type: "offer", sdp: "v=0\r\n...offer" },
  };
  const value: WhatsappWebhook.CallsValue = {
    messaging_product: "whatsapp",
    metadata: { display_phone_number: "+1 800 555 0100", phone_number_id: "18005550100" },
    calls: [call],
  } as any;
  return { kind: "call", data: { kind: "calls", value } } as IncomingMessage;
}

function makeOutboundConnectAnswer(): IncomingMessage {
  const call: WhatsappWebhook.CallItem = {
    id: "wacid.out.1",
    from: "18005550100",
    to: "15557654321",
    event: "connect",
    timestamp: String(Math.floor(Date.now() / 1000)),
    direction: "BUSINESS_INITIATED",
    session: { sdp_type: "answer", sdp: "v=0\r\n...answer" },
  };
  const value: WhatsappWebhook.CallsValue = {
    messaging_product: "whatsapp",
    metadata: { display_phone_number: "+1 800 555 0100", phone_number_id: "18005550100" },
    calls: [call],
  } as any;
  return { kind: "call", data: { kind: "calls", value } } as IncomingMessage;
}

function makeCallStatus(
  callId: string,
  status: WhatsappWebhook.CallStatusValue,
  opaque?: string
): IncomingMessage {
  const s: WhatsappWebhook.CallStatusItem = {
    id: callId,
    type: "call",
    status,
    timestamp: String(Math.floor(Date.now() / 1000)),
    recipient_id: "15557654321",
    biz_opaque_callback_data: opaque,
  };
  const value: WhatsappWebhook.CallsValue = {
    messaging_product: "whatsapp",
    metadata: { display_phone_number: "", phone_number_id: "" },
    calls: [] as any,
    statuses: [s],
  } as any;
  return { kind: "call", data: { kind: "statuses", value } } as IncomingMessage;
}

// ---- Tests ----

test("inbound calling flow: connect -> accept -> connected -> end (reject)", async () => {
  renderPage();

  // Simulate inbound connect offer via websocket
  await act(async () => {
    emitWS(makeInboundConnect());
  });

  // CallBox should appear with Accept button
  const title = await screen.findByText(/Incoming WhatsApp Call/i);
  expect(title).toBeInTheDocument();
  const acceptBtn = screen.getByRole("button", { name: /accept/i });
  expect(acceptBtn).toBeEnabled();

  // Accept the call -> should POST accept and eventually show Connected
  await act(async () => {
    fireEvent.click(acceptBtn);
  });

  // Accept should hit the call endpoint with action accept
  const fetchCalls = (global.fetch as jest.Mock).mock.calls.filter(([u]: any[]) =>
    String(u).includes("/api/admin/whatsapp/call")
  );
  expect(fetchCalls.length).toBeGreaterThan(0);
  const acceptBodies = (global.fetch as jest.Mock).mock.calls
    .filter(([u]: any[]) => String(u).includes("/api/admin/whatsapp/call"))
    .map(([, init]: any[]) => (init && init.body ? JSON.parse(init.body) : null))
    .filter((b: any) => b && b.action === "accept");
  expect(acceptBodies.length).toBeGreaterThan(0);

  // After fake RTCPeerConnection connects, UI should switch to Connected
  const connectedText = await screen.findByText(/Connected/i);
  expect(connectedText).toBeInTheDocument();

  // End call -> inbound uses reject
  const endBtn = screen.getByRole("button", { name: /end call|reject/i });
  await act(async () => {
    fireEvent.click(endBtn);
  });

  const rejectBodies = (global.fetch as jest.Mock).mock.calls
    .filter(([u]: any[]) => String(u).includes("/api/admin/whatsapp/call"))
    .map(([, init]: any[]) => (init && init.body ? JSON.parse(init.body) : null))
    .filter((b: any) => b && b.action === "reject");
  expect(rejectBodies.length).toBeGreaterThan(0);

  // Call box should disappear
  await act(async () => {
    jest.advanceTimersByTime(0);
  });
  expect(screen.queryByText(/WhatsApp Call|Incoming WhatsApp Call/i)).not.toBeInTheDocument();
});

test("outbound calling flow: connect(answer) -> statuses ACCEPTED -> connected -> end (terminate)", async () => {
  renderPage();

  // Simulate outbound connect with ANSWER (from webhook)
  await act(async () => {
    emitWS(makeOutboundConnectAnswer());
  });

  // Call box should appear in dialing state initially (until ACCEPTED)
  const title = await screen.findByText(/Outbound WhatsApp Call|WhatsApp Call/i);
  expect(title).toBeInTheDocument();
  expect(screen.getByText(/Dialing/i)).toBeInTheDocument();

  // Now send ACCEPTED status for this call id
  await act(async () => {
    emitWS(makeCallStatus("wacid.out.1", "ACCEPTED"));
  });

  // Should now show Connected and start timer text
  const connected = await screen.findByText(/Connected/i);
  expect(connected).toBeInTheDocument();

  // End call -> outbound uses terminate
  const endBtn = screen.getByRole("button", { name: /end call/i });
  await act(async () => {
    fireEvent.click(endBtn);
  });

  const terminateBodies = (global.fetch as jest.Mock).mock.calls
    .filter(([u]: any[]) => String(u).includes("/api/admin/whatsapp/call"))
    .map(([, init]: any[]) => (init && init.body ? JSON.parse(init.body) : null))
    .filter((b: any) => b && b.action === "terminate");
  expect(terminateBodies.length).toBeGreaterThan(0);

  // Disappears
  await act(async () => {
    jest.advanceTimersByTime(0);
  });
  expect(screen.queryByText(/WhatsApp Call|Outbound WhatsApp Call/i)).not.toBeInTheDocument();
});
