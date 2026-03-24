import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type CallEngineState =
  | "IDLE"
  | "PRE_ACCEPTING"
  | "PRE_ACCEPTED"
  | "ACCEPTING"
  | "CONNECTED"
  | "ENDING"
  | "ENDED"
  | "ERROR";

export type UseCallEngineOptions = {
  debug?: boolean;
  iceServers?: RTCIceServer[];
  // Auto-reject if not accepted within this window after bind(); defaults to 25s
  acceptTimeoutMs?: number;
};

type SilentAudio = {
  ctx: AudioContext;
  track: MediaStreamTrack;
  stream: MediaStream;
};

type PostAction = "pre_accept" | "accept" | "reject" | "terminate";

type StartOutboundOpts = {
  toWaId: string; // callee WhatsApp ID (E.164 digits)
  phoneNumberId: string; // business WhatsApp number (digits) used as originator
  bizOpaque?: string;
};

type ApplyAnswerOpts = {
  callId: string;
  phoneNumberId: string; // business WhatsApp number (digits)
  answerSdp: string;
};

export type CallEngine = {
  state: CallEngineState;
  stateReason: string | null;
  bind: (callId: string) => void;
  preAccept: (offerSdp: string, toPhoneNumberId: string) => Promise<void>;
  accept: () => Promise<void>;
  reject: () => Promise<void>;
  terminate: () => Promise<void>;
  endLocal: () => void;
  remoteStream: MediaStream | null;
  setDebug: (on: boolean) => void;
  setInputDevice: (deviceId: string) => Promise<void>;
  startOutbound: (opts: StartOutboundOpts) => Promise<void>;
  applyAnswer: (opts: ApplyAnswerOpts) => Promise<void>;
};

export function useCallEngine(options?: UseCallEngineOptions): CallEngine {
  const [state, setState] = useState<CallEngineState>("IDLE");
  const [stateReason, setStateReason] = useState<string | null>(null);
  const [fetchedIceServers, setFetchedIceServers] = useState<RTCIceServer[] | null>(null);

  const stateRef = useRef<CallEngineState>("IDLE");
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const senderRef = useRef<RTCRtpSender | null>(null);
  const silentRef = useRef<SilentAudio | null>(null);
  const preAcceptSdpRef = useRef<string | null>(null);
  const callIdRef = useRef<string | null>(null);
  const phoneNumberIdRef = useRef<string | null>(null);
  const debugRef = useRef<boolean>(Boolean(options?.debug));
  const acceptTimerRef = useRef<number | null>(null);
  const statsTimerRef = useRef<number | null>(null);
  const connectedAtRef = useRef<number | null>(null);
  const outBytesRef = useRef<{ last: number; stagnant: number }>({ last: 0, stagnant: 0 });
  const inBytesRef = useRef<{ last: number; stagnant: number }>({ last: 0, stagnant: 0 });

  const iceServers: RTCIceServer[] = useMemo(() => {
    if (options?.iceServers && options.iceServers.length > 0) {
      return options.iceServers;
    }
    if (fetchedIceServers) {
      return fetchedIceServers;
    }
    // Fallback to public STUN only if no TURN data yet
    return [{ urls: ["stun:stun.l.google.com:19302"] }];
  }, [options?.iceServers, fetchedIceServers]);

  // Load ICE servers once on mount
  useEffect(() => {
    let cancelled = false;

    async function loadIceServers() {
      try {
        const res = await fetch("/api/admin/turn");
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled && Array.isArray(data.iceServers)) {
          setFetchedIceServers(data.iceServers);
        }
      } catch (e) {
        console.warn("[CallEngine] Failed to fetch ICE servers, falling back to default:", e);
      }
    }

    loadIceServers();

    return () => {
      cancelled = true;
    };
  }, []);

  // Periodically refresh time-limited TURN credentials
  useEffect(() => {
    const interval = window.setInterval(
      () => {
        fetch("/api/admin/turn")
          .then((r) => r.json())
          .then((data) => {
            if (Array.isArray(data?.iceServers)) {
              setFetchedIceServers(data.iceServers);
            }
          })
          .catch(() => {});
      },
      55 * 60 * 1000
    );
    return () => clearInterval(interval);
  }, []);

  const startStats = useCallback((pc: RTCPeerConnection) => {
    if (!debugRef.current || statsTimerRef.current) {
      return;
    }
    statsTimerRef.current = window.setInterval(async () => {
      try {
        const stats = await pc.getStats();
        let out: any = null;
        let inn: any = null;
        stats.forEach((r: any) => {
          const kind = r.kind || r.mediaType;
          if (r.type === "outbound-rtp" && kind === "audio") {
            out = { bytesSent: r.bytesSent };
          }
          if (r.type === "inbound-rtp" && kind === "audio") {
            inn = { bytesReceived: r.bytesReceived };
          }
        });
        if (typeof out?.bytesSent === "number") {
          if (outBytesRef.current.last === out.bytesSent) {
            outBytesRef.current.stagnant += 1;
          } else {
            outBytesRef.current.last = out.bytesSent;
            outBytesRef.current.stagnant = 0;
          }
        }
        if (typeof inn?.bytesReceived === "number") {
          if (inBytesRef.current.last === inn.bytesReceived) {
            inBytesRef.current.stagnant += 1;
          } else {
            inBytesRef.current.last = inn.bytesReceived;
            inBytesRef.current.stagnant = 0;
          }
        }
        const now = Date.now();
        const connectedAt = connectedAtRef.current || 0;
        if (connectedAt && now - connectedAt > 5000) {
          if (outBytesRef.current.stagnant >= 5) {
            console.warn("[CallEngine] stagnant uplink >=5s");
          }
          if (inBytesRef.current.stagnant >= 5) {
            console.warn("[CallEngine] stagnant downlink >=5s");
          }
        }
      } catch {}
    }, 1000);
  }, []);

  const setDebug = useCallback(
    (on: boolean) => {
      debugRef.current = on;
      if (!on && statsTimerRef.current) {
        clearInterval(statsTimerRef.current);
        statsTimerRef.current = null;
      }
      if (on && pcRef.current && !statsTimerRef.current) {
        startStats(pcRef.current);
      }
    },
    [startStats]
  );

  const stopStats = useCallback(() => {
    if (statsTimerRef.current) {
      clearInterval(statsTimerRef.current);
      statsTimerRef.current = null;
    }
  }, []);

  const setStateSafe = useCallback((s: CallEngineState, reason?: string | null) => {
    setState(s);
    stateRef.current = s;
    if (typeof reason === "string" || reason === null) {
      setStateReason(reason ?? null);
    }
  }, []);

  const endLocal = useCallback(() => {
    try {
      pcRef.current?.getSenders().forEach((s) => s.track?.stop());
      pcRef.current?.getReceivers().forEach((r) => r.track?.stop());
      pcRef.current?.close();
    } catch {}
    pcRef.current = null;
    preAcceptSdpRef.current = null;
    senderRef.current = null;
    remoteStreamRef.current = null;
    connectedAtRef.current = null;
    if (acceptTimerRef.current) {
      clearTimeout(acceptTimerRef.current);
      acceptTimerRef.current = null;
    }
    stopStats();
    // Keep silent audio context alive is optional; we do not close ctx here intentionally
    setStateSafe("ENDED");
  }, [setStateSafe, stopStats]);

  const createPc = useCallback((): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers, iceTransportPolicy: "relay" });

    remoteStreamRef.current = new MediaStream();
    pc.ontrack = (ev) => {
      try {
        const remote = remoteStreamRef.current!;
        for (const t of ev.streams[0].getTracks()) {
          remote.addTrack(t);
        }
        const el = document.getElementById("mg-wa-call-audio") as HTMLAudioElement | null;
        if (el && el.srcObject !== remote) {
          el.srcObject = remote;
        }
      } catch {}
    };

    pc.onconnectionstatechange = () => {
      if (debugRef.current) {
        console.info("[CallEngine] pc state", pc.connectionState);
      }
      if (pc.connectionState === "connected") {
        setStateSafe("CONNECTED", null);
        // Clear accept auto-reject timer once connected
        if (acceptTimerRef.current) {
          clearTimeout(acceptTimerRef.current);
          acceptTimerRef.current = null;
        }
        connectedAtRef.current = Date.now();
        outBytesRef.current = { last: 0, stagnant: 0 };
        inBytesRef.current = { last: 0, stagnant: 0 };
      }
      if (pc.connectionState === "failed") {
        setStateSafe("ERROR", "peer-connection-failed");
        endLocal();
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (debugRef.current) {
        console.info("[CallEngine] ice state", pc.iceConnectionState);
      }
      if (pc.iceConnectionState === "failed") {
        setStateSafe("ERROR", "ice-failed");
        endLocal();
      }
    };

    pc.onsignalingstatechange = () => {
      if (debugRef.current) {
        console.info("[CallEngine] signaling state", pc.signalingState);
      }
    };

    pc.onicecandidateerror = (ev) => {
      if (debugRef.current) {
        console.warn(
          `[CallEngine] ICE candidate error: ${ev.errorCode} ${ev.errorText} (url: ${ev.url})`
        );
      }
    };

    pc.onicegatheringstatechange = () => {
      if (debugRef.current) {
        console.info("[CallEngine] ICE gathering state", pc.iceGatheringState);
      }
    };

    if (debugRef.current) {
      startStats(pc);
    }

    return pc;
  }, [iceServers, endLocal, setStateSafe, startStats]);

  // WhatsApp Cloud API is strict: audio-only (Opus). Remove other m-sections/codecs and disallowed opts.
  const sanitizeOfferForWhatsApp = useCallback((sdp: string): string => {
    try {
      const lines = sdp.split(/\r?\n/);
      const result: string[] = [];
      let inAudio = false;
      let audioIndex = -1;
      let opusPt: string | null = null;
      let currentSection: "session" | "audio" | "other" = "session";
      // First pass: find opus payload type and drop non-audio sections
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (!l) {
          continue;
        }
        if (l.startsWith("m=")) {
          if (l.startsWith("m=audio")) {
            inAudio = true;
            currentSection = "audio";
            audioIndex = result.length; // placeholder, will rewrite later
            result.push(l); // temp
          } else {
            inAudio = false;
            currentSection = "other";
          }
          continue;
        }
        if (currentSection === "session") {
          // Session-level: keep most, drop extmap-allow-mixed and ice trickle option
          if (l.startsWith("a=extmap-allow-mixed")) {
            continue;
          }
          if (l.startsWith("a=ice-options:trickle")) {
            continue;
          }
          result.push(l);
        } else if (currentSection === "audio") {
          // Track opus PT from rtpmap
          const m = l.match(/^a=rtpmap:(\d+)\s+opus\//i);
          if (m) {
            opusPt = m[1];
          }
          // Keep for now; second pass will filter
          result.push(l);
        } else {
          // other m= sections (video/application) – drop entirely
          // skip
        }
      }

      if (audioIndex < 0 || !opusPt) {
        // No audio or no opus found – return original SDP; let server error surface
        return sdp;
      }

      // Second pass: rewrite audio m= line to only include opus, and remove non-opus codec lines
      const cleaned: string[] = [];
      let withinAudio = false;
      let hadEndOfCandidates = false;
      for (let i = 0; i < result.length; i++) {
        const l = result[i];
        if (l.startsWith("m=")) {
          withinAudio = l.startsWith("m=audio");
        }
        if (!withinAudio) {
          cleaned.push(l);
          continue;
        }

        if (l.startsWith("m=audio")) {
          const parts = l.split(" ");
          // m=audio <port> <proto> <pt...>
          const mline = [parts[0], parts[1] || "9", parts[2] || "UDP/TLS/RTP/SAVPF", opusPt].join(
            " "
          );
          cleaned.push(mline);
          continue;
        }

        if (
          /^a=rtpmap:/.test(l) &&
          !l.includes(`rtpmap:${opusPt} `) &&
          !l.includes(`rtpmap:${opusPt}\t`)
        ) {
          continue;
        }
        if (/^a=fmtp:/.test(l) && !l.startsWith(`a=fmtp:${opusPt}`)) {
          continue;
        }
        if (/^a=rtcp-fb:/.test(l) && !l.startsWith(`a=rtcp-fb:${opusPt}`)) {
          continue;
        }
        if (l.startsWith("a=extmap-allow-mixed")) {
          continue;
        }
        if (l.startsWith("a=ice-options:trickle")) {
          continue;
        }
        if (l.startsWith("a=end-of-candidates")) {
          hadEndOfCandidates = true;
        }
        cleaned.push(l);
      }

      // Ensure end-of-candidates in audio section
      if (!hadEndOfCandidates) {
        // Append at end
        cleaned.push("a=end-of-candidates");
      }

      // Ensure rtcp-mux present (WebRTC includes, but add if missing)
      if (!cleaned.some((l) => l === "a=rtcp-mux")) {
        // place near the end
        cleaned.push("a=rtcp-mux");
      }

      return cleaned.join("\r\n");
    } catch {
      return sdp;
    }
  }, []);

  const ensureSilent = useCallback((): SilentAudio => {
    if (silentRef.current) {
      return silentRef.current;
    }
    const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const dest = ctx.createMediaStreamDestination();
    osc.connect(gain);
    gain.connect(dest);
    osc.start();
    const track = dest.stream.getAudioTracks()[0];
    silentRef.current = { ctx, track, stream: dest.stream };
    return silentRef.current;
  }, []);

  const waitIceComplete = useCallback((pc: RTCPeerConnection, ms = 1500): Promise<void> => {
    return Promise.race([
      new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") {
          return resolve();
        }
        const onChange = () => {
          if (pc.iceGatheringState === "complete") {
            pc.removeEventListener("icegatheringstatechange", onChange);
            resolve();
          }
        };
        pc.addEventListener("icegatheringstatechange", onChange);
      }),
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms);
      }),
    ]);
  }, []);

  const postCall = useCallback(async (action: PostAction, payload: any) => {
    // Small retry loop for transient failures
    const maxAttempts = 3;
    const timeoutMs = 6000;
    let lastErr: any = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const ac = new AbortController();
      const t = window.setTimeout(() => ac.abort(), timeoutMs);
      try {
        const res = await fetch("/api/admin/whatsapp/call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            callId: payload.callId,
            businessWhatsappId: payload.phoneNumberId,
            session: payload.sdp
              ? {
                  sdp_type: "answer",
                  sdp: payload.sdp,
                }
              : undefined,
          }),
          signal: ac.signal,
        });
        window.clearTimeout(t);
        if (res.ok) {
          return;
        }
        // Do not retry on obvious client errors
        if (res.status >= 400 && res.status < 500) {
          const txt = await res.text().catch(() => "");
          throw new Error(`call action ${action} failed: ${res.status} ${txt}`);
        }
        lastErr = new Error(`call action ${action} failed: ${res.status}`);
      } catch (e) {
        lastErr = e;
      }
      await new Promise((r) => setTimeout(r, attempt * 250));
    }
    throw lastErr || new Error(`call action ${action} failed`);
  }, []);

  const bind = useCallback(
    (callId: string) => {
      if (!callId) {
        return;
      }
      if (callIdRef.current && callIdRef.current !== callId) {
        // New call arriving while one is active: end previous local session
        endLocal();
      }
      callIdRef.current = callId;
      preAcceptSdpRef.current = null;
      setStateSafe("IDLE", null);
      if (acceptTimerRef.current) {
        clearTimeout(acceptTimerRef.current);
        acceptTimerRef.current = null;
      }
      // Auto-reject if not accepted within window
      const timeout = options?.acceptTimeoutMs ?? 25000;
      acceptTimerRef.current = window.setTimeout(async () => {
        if (stateRef.current !== "CONNECTED" && callIdRef.current === callId) {
          try {
            await postCall("reject", {
              callId: callIdRef.current,
              phoneNumberId: phoneNumberIdRef.current,
            });
          } catch {}
          setStateSafe("ERROR", "answer-timeout");
          endLocal();
        }
      }, timeout) as unknown as number;
    },
    [endLocal, options?.acceptTimeoutMs, postCall, setStateSafe]
  );

  const preAccept = useCallback(
    async (offerSdp: string, toPhoneNumberId: string) => {
      if (!callIdRef.current) {
        throw new Error("bind() must be called first");
      }
      if (!offerSdp) {
        throw new Error("offer SDP required");
      }
      phoneNumberIdRef.current = toPhoneNumberId;
      if (state === "PRE_ACCEPTED" || state === "CONNECTED") {
        return;
      }
      setStateSafe("PRE_ACCEPTING", null);

      const pc = pcRef.current || createPc();
      pcRef.current = pc;
      await pc.setRemoteDescription({ type: "offer", sdp: offerSdp });

      const trans =
        pc
          .getTransceivers()
          .find((t) => t.receiver?.track?.kind === "audio" || t.mid === "audio") ||
        pc.addTransceiver("audio", { direction: "sendrecv" });

      try {
        if ((trans as any).setDirection) {
          (trans as any).setDirection("sendrecv");
        } else {
          (trans as any).direction = "sendrecv";
        }
      } catch {}

      const silent = ensureSilent();
      try {
        trans.sender.setStreams(silent.stream);
      } catch {}
      await trans.sender.replaceTrack(silent.track);
      senderRef.current = trans.sender;
    },
    [createPc, ensureSilent, setStateSafe, state]
  );

  const accept = useCallback(async () => {
    if (state !== "PRE_ACCEPTED" && state !== "PRE_ACCEPTING") {
      return;
    }
    setStateSafe("ACCEPTING", null);
    // User accepted: stop the auto-reject timer
    if (acceptTimerRef.current) {
      clearTimeout(acceptTimerRef.current);
      acceptTimerRef.current = null;
    }
    // If we haven't created an answer yet (no pre-accept), do it now
    if (!preAcceptSdpRef.current) {
      if (!pcRef.current) {
        throw new Error("peer connection missing during accept");
      }
      const ans = await pcRef.current.createAnswer();
      await pcRef.current.setLocalDescription(ans);
      await waitIceComplete(pcRef.current);
      preAcceptSdpRef.current = pcRef.current.localDescription?.sdp || ans.sdp || "";
    }

    // Send SDP answer to server as the Accept action
    await postCall("accept", {
      callId: callIdRef.current,
      phoneNumberId: phoneNumberIdRef.current,
      sdp: preAcceptSdpRef.current,
    });

    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      const micTrack = mic.getAudioTracks()[0] || null;
      if (senderRef.current && micTrack) {
        // Preserve the silent stream's msid association
        try {
          const silent = silentRef.current;
          if (silent) {
            senderRef.current.setStreams(silent.stream);
          }
        } catch {}
        await senderRef.current.replaceTrack(micTrack);
      } else if (pcRef.current && mic) {
        for (const track of mic.getTracks()) {
          pcRef.current.addTrack(track, mic);
        }
      }
      const el = document.getElementById("mg-wa-call-audio") as HTMLAudioElement | null;
      if (el) {
        el.muted = false;
        el.volume = 1.0;
        if (remoteStreamRef.current && el.srcObject !== remoteStreamRef.current) {
          el.srcObject = remoteStreamRef.current;
        }
        try {
          await el.play();
        } catch {}
      }
      // If ICE already completed, transition to CONNECTED now
      if (pcRef.current?.connectionState === "connected") {
        setStateSafe("CONNECTED", null);
        connectedAtRef.current = Date.now();
      }
    } catch (e) {
      setStateSafe("ERROR", "mic-failure");
      throw e;
    }
  }, [postCall, setStateSafe, state, waitIceComplete]);

  const reject = useCallback(async () => {
    if (!callIdRef.current) {
      return;
    }
    try {
      await postCall("reject", {
        callId: callIdRef.current,
        phoneNumberId: phoneNumberIdRef.current,
      });
    } finally {
      endLocal();
    }
  }, [endLocal, postCall]);

  const terminate = useCallback(async () => {
    if (!callIdRef.current) {
      return;
    }
    setStateSafe("ENDING", null);
    try {
      await postCall("terminate", {
        callId: callIdRef.current,
        phoneNumberId: phoneNumberIdRef.current,
      });
    } finally {
      endLocal();
    }
  }, [endLocal, postCall, setStateSafe]);

  // Replace the outgoing audio track with a given deviceId
  const setInputDevice = useCallback(async (deviceId: string) => {
    // Allow switching both when CONNECTED and during ACCEPTING (track will bind when sender exists)
    try {
      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      } as MediaStreamConstraints;
      const mic = await navigator.mediaDevices.getUserMedia(constraints);
      const micTrack = mic.getAudioTracks()[0] || null;
      if (senderRef.current && micTrack) {
        try {
          const silent = silentRef.current;
          if (silent) {
            senderRef.current.setStreams(silent.stream);
          }
        } catch {}
        await senderRef.current.replaceTrack(micTrack);
      } else if (pcRef.current && mic) {
        for (const track of mic.getTracks()) {
          pcRef.current.addTrack(track, mic);
        }
      }
    } catch (e) {
      // Surface error state for UI if desired in future; for now just log
      if (debugRef.current) {
        console.warn("[CallEngine] setInputDevice failed", e);
      }
      throw e;
    }
  }, []);

  // Initiate a business-initiated outbound call: create local offer and POST connect
  const startOutbound = useCallback(
    async (opts: StartOutboundOpts) => {
      const { toWaId, phoneNumberId, bizOpaque } = opts;
      if (!toWaId || !phoneNumberId) {
        throw new Error("toWaId and phoneNumberId are required");
      }

      const pc = pcRef.current || createPc();
      pcRef.current = pc;

      // Ensure we have an audio transceiver and attach silent track initially
      const trans = pc.addTransceiver("audio", { direction: "sendrecv" });
      try {
        (trans as any).setDirection?.("sendrecv");
      } catch {}

      const silent = ensureSilent();
      try {
        trans.sender.setStreams(silent.stream);
      } catch {}
      await trans.sender.replaceTrack(silent.track);
      senderRef.current = trans.sender;

      // Create SDP offer and set as local
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      // Wait longer to collect TURN candidates so SDP is complete
      await waitIceComplete(pc, 5000);
      let frozenOffer = pc.localDescription?.sdp || offer.sdp || "";
      // Sanitize SDP to comply with WhatsApp calling requirements
      frozenOffer = sanitizeOfferForWhatsApp(frozenOffer);

      setStateSafe("PRE_ACCEPTING", "dialing");

      // Send connect to server; server expects businessWhatsappId (display number)
      const res = await fetch("/api/admin/whatsapp/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "connect",
          to: toWaId,
          businessWhatsappId: phoneNumberId,
          session: { sdp_type: "offer", sdp: frozenOffer },
          biz_opaque_callback_data: bizOpaque,
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        setStateSafe("ERROR", txt.includes("138006") ? "no-permission" : "connect-failed");
        throw new Error(`connect failed: ${res.status} ${txt}`);
      }
      const json = await res.json().catch(() => ({}) as any);
      const callId = json?.callId || json?.id;
      if (callId) {
        phoneNumberIdRef.current = phoneNumberId;
        bind(callId);
      }
    },
    [bind, createPc, ensureSilent, sanitizeOfferForWhatsApp, setStateSafe, waitIceComplete]
  );

  // Apply ANSWER SDP for business-initiated calls
  const applyAnswer = useCallback(
    async (opts: ApplyAnswerOpts) => {
      const { callId, phoneNumberId, answerSdp } = opts;
      if (!answerSdp || !callId || !phoneNumberId) {
        throw new Error("applyAnswer requires callId, phoneNumberId, and answerSdp");
      }
      if (!pcRef.current) {
        pcRef.current = createPc();
      }
      phoneNumberIdRef.current = phoneNumberId;
      callIdRef.current = callId;

      const pc = pcRef.current!;
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      // We have an explicit ANSWER; clear the auto-reject timer immediately
      if (acceptTimerRef.current) {
        clearTimeout(acceptTimerRef.current);
        acceptTimerRef.current = null;
      }

      try {
        // Reflect acceptance for outbound flows by proceeding to attach mic/remote audio
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        const micTrack = mic.getAudioTracks()[0] || null;
        if (senderRef.current && micTrack) {
          try {
            const silent = silentRef.current;
            if (silent) {
              senderRef.current.setStreams(silent.stream);
            }
          } catch {}
          await senderRef.current.replaceTrack(micTrack);
        } else if (pc && mic) {
          for (const track of mic.getTracks()) {
            pc.addTrack(track, mic);
          }
        }
        const el = document.getElementById("mg-wa-call-audio") as HTMLAudioElement | null;
        if (el) {
          el.muted = false;
          el.volume = 1.0;
          if (remoteStreamRef.current && el.srcObject !== remoteStreamRef.current) {
            el.srcObject = remoteStreamRef.current;
          }
          try {
            await el.play();
          } catch {}
        }
        if (pc.connectionState === "connected") {
          setStateSafe("CONNECTED", null);
          if (acceptTimerRef.current) {
            clearTimeout(acceptTimerRef.current);
            acceptTimerRef.current = null;
          }
          connectedAtRef.current = Date.now();
        }
      } catch (e) {
        setStateSafe("ERROR", "mic-failure");
        throw e;
      }
    },
    [createPc, setStateSafe]
  );

  useEffect(() => {
    return () => {
      if (acceptTimerRef.current) {
        clearTimeout(acceptTimerRef.current);
      }
      stopStats();
    };
  }, [stopStats]);

  return {
    state,
    stateReason,
    bind,
    preAccept,
    accept,
    reject,
    terminate,
    endLocal,
    remoteStream: remoteStreamRef.current,
    setDebug,
    setInputDevice,
    startOutbound,
    applyAnswer,
  };
}
