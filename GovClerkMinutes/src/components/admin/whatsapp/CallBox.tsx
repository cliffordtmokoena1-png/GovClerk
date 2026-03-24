import { Box, Button, Flex, Select, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { WhatsappWebhook } from "@/admin/whatsapp/types";
import type { CallEngineState } from "@/admin/whatsapp/hooks/useCallEngine";

type Props = {
  // The current call item if available (inbound, or outbound after webhook connect)
  call?: WhatsappWebhook.CallItem;
  // Optional explicit endpoints to display when dialing outbound before webhook arrives
  target?: { from: string; to: string };
  // Accept is only meaningful for inbound calls
  onAccept: (call?: WhatsappWebhook.CallItem) => void;
  // For inbound this rejects; for outbound this ends/terminates
  onReject: (call?: WhatsappWebhook.CallItem) => void;
  onDismiss: () => void;
  engineState: CallEngineState;
  callerName?: string;
  setMicDevice: (deviceId: string) => Promise<void>;
  // Hint to adjust UI for outbound flows when call is not yet available
  isOutbound?: boolean;
  // Optional call status from webhook for outbound (RINGING/ACCEPTED/REJECTED)
  status?: WhatsappWebhook.CallStatusValue;
};

export default function CallBox({
  call,
  target,
  onAccept,
  onReject,
  onDismiss,
  engineState,
  callerName,
  setMicDevice,
  isOutbound,
  status,
}: Props) {
  // Call duration timer state
  const [connectedSince, setConnectedSince] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState<number>(0);

  // Devices state
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedInputId, setSelectedInputId] = useState<string>("");
  const [selectedOutputId, setSelectedOutputId] = useState<string>("");
  const [deviceError, setDeviceError] = useState<string | null>(null);

  // Mic level meter
  const [level, setLevel] = useState<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const meterStreamRef = useRef<MediaStream | null>(null);

  const inCall = useMemo(() => {
    return engineState === "CONNECTED" || engineState === "ACCEPTING" || engineState === "ENDING";
  }, [engineState]);

  // Determine direction: if we have a call, use it; otherwise rely on isOutbound hint
  const isInbound = useMemo(() => {
    if (call?.direction) {
      return call.direction === "USER_INITIATED";
    }
    return !isOutbound;
  }, [call?.direction, isOutbound]);

  const isConnected = engineState === "CONNECTED";
  const isAccepted = status === "ACCEPTED";

  // Start/stop timer
  // Inbound: start when WebRTC is connected
  // Outbound: start only when ACCEPTED status arrives
  useEffect(() => {
    const shouldStart = isOutbound ? isAccepted : isConnected;
    if (shouldStart && connectedSince == null) {
      setConnectedSince(Date.now());
    }
  }, [isOutbound, isAccepted, isConnected, connectedSince]);

  useEffect(() => {
    if (connectedSince == null) {
      setElapsed(0);
      return;
    }
    const t = window.setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - connectedSince) / 1000)));
    }, 1000);
    return () => window.clearInterval(t);
  }, [connectedSince]);

  // Enumerate devices once permission is likely granted (post-accept), or on mount if already granted
  useEffect(() => {
    let cancelled = false;
    async function loadDevices() {
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) {
          return;
        }
        const ins = list.filter((d) => d.kind === "audioinput");
        const outs = list.filter((d) => d.kind === "audiooutput");
        setInputs(ins);
        setOutputs(outs);
        if (!selectedInputId && ins.length > 0) {
          setSelectedInputId(ins[0].deviceId);
        }
        if (!selectedOutputId && outs.length > 0) {
          setSelectedOutputId(outs[0].deviceId);
        }
      } catch (e: any) {
        setDeviceError(e?.message || "Failed to enumerate audio devices");
      }
    }
    // Try to enumerate immediately
    loadDevices();
    // Also re-run on connect
    if (isConnected) {
      loadDevices();
    }
    return () => {
      cancelled = true;
    };
  }, [isConnected, selectedInputId, selectedOutputId]);

  // Level meter: start when connected and an input device is selected
  useEffect(() => {
    async function startMeter(deviceId?: string) {
      try {
        // Stop previous
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        if (meterStreamRef.current) {
          for (const t of meterStreamRef.current.getTracks()) {
            t.stop();
          }
          meterStreamRef.current = null;
        }
        if (!isConnected) {
          return;
        }

        const constraints: MediaStreamConstraints = {
          audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        } as MediaStreamConstraints;
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        meterStreamRef.current = stream;

        const Ctx: any = (window as any).AudioContext || (window as any).webkitAudioContext;
        const ctx: AudioContext = audioCtxRef.current || new Ctx();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyserRef.current = analyser;
        src.connect(analyser);

        const data = new Uint8Array(analyser.fftSize);
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          // Compute RMS level 0..1
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          setLevel(Math.min(1, rms * 2));
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (e: any) {
        setDeviceError(e?.message || "Microphone access failed");
      }
    }

    startMeter(selectedInputId);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = null;
      if (meterStreamRef.current) {
        for (const t of meterStreamRef.current.getTracks()) {
          t.stop();
        }
        meterStreamRef.current = null;
      }
    };
  }, [isConnected, selectedInputId]);

  // Handle output device change using setSinkId if supported
  const applyOutputDevice = async (deviceId: string) => {
    setSelectedOutputId(deviceId);
    const el = document.getElementById("mg-wa-call-audio") as any;
    if (el && typeof el.setSinkId === "function") {
      try {
        await el.setSinkId(deviceId);
      } catch (e: any) {
        setDeviceError(e?.message || "Failed to set output device");
      }
    }
  };

  // Handle input device change via engine hook if available
  const applyInputDevice = async (deviceId: string) => {
    setSelectedInputId(deviceId);
    try {
      if (setMicDevice) {
        await setMicDevice(deviceId);
      }
    } catch (e: any) {
      setDeviceError(e?.message || "Failed to set input device");
    }
  };

  const renderTimer = () => {
    const seconds = elapsed % 60;
    const minutes = Math.floor(elapsed / 60) % 60;
    const hours = Math.floor(elapsed / 3600);
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
  };

  // Resolve display endpoints
  const from = call?.from ?? target?.from ?? "";
  const to = call?.to ?? target?.to ?? "";

  return (
    <Box
      position="fixed"
      right={4}
      bottom={4}
      zIndex={1000}
      bg="white"
      borderWidth="1px"
      borderRadius="md"
      boxShadow="lg"
      p={4}
      w={{ base: "calc(100% - 2rem)", md: "360px" }}
    >
      <Text fontWeight="bold" mb={1}>
        {inCall ? "WhatsApp Call" : isInbound ? "Incoming WhatsApp Call" : "Outbound WhatsApp Call"}
      </Text>
      <Text fontSize="sm" color="gray.600" mb={1}>
        {callerName ? `${callerName} (${from})` : from} ➝ {to}
      </Text>
      {inCall ? (
        <Text fontSize="sm" color={isAccepted ? "green.600" : "orange.600"} mb={3}>
          {isOutbound
            ? isAccepted
              ? `Connected · ${renderTimer()}`
              : "Dialing..."
            : isConnected
              ? `Connected · ${renderTimer()}`
              : "Connecting..."}
        </Text>
      ) : (
        <Text fontSize="sm" color="gray.600" mb={3}>
          {isInbound ? "Tap Accept to start" : status === "RINGING" ? "Ringing..." : "Dialing..."}
        </Text>
      )}

      <Flex gap={2} mb={inCall ? 3 : 0}>
        {!inCall && isInbound && (
          <Button colorScheme="green" size="sm" onClick={() => onAccept(call)}>
            Accept
          </Button>
        )}
        <Button
          colorScheme={inCall ? "red" : "red"}
          size="sm"
          variant={inCall ? "solid" : "outline"}
          onClick={() => onReject(call)}
        >
          {inCall || !isInbound ? "End call" : "Reject"}
        </Button>
        {!inCall && (
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        )}
      </Flex>

      {inCall && (
        <Box mb={3}>
          {/* Audio device selectors */}
          <Flex gap={2} mb={2} align="center">
            <Box flex={1}>
              <Text fontSize="xs" color="gray.500" mb={1}>
                Microphone
              </Text>
              <Select
                size="sm"
                value={selectedInputId}
                onChange={(e) => applyInputDevice(e.target.value)}
              >
                {inputs.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || d.deviceId}
                  </option>
                ))}
              </Select>
            </Box>
            <Box flex={1}>
              <Text fontSize="xs" color="gray.500" mb={1}>
                Output
              </Text>
              <Select
                size="sm"
                value={selectedOutputId}
                onChange={(e) => applyOutputDevice(e.target.value)}
                isDisabled={outputs.length === 0}
              >
                {outputs.length === 0 ? (
                  <option value="">System default</option>
                ) : (
                  outputs.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || d.deviceId}
                    </option>
                  ))
                )}
              </Select>
            </Box>
          </Flex>

          {/* Mic level meter */}
          <Box>
            <Text fontSize="xs" color="gray.500" mb={1}>
              Mic level
            </Text>
            <Box h="8px" bg="gray.200" borderRadius="full" overflow="hidden">
              <Box h="100%" w={`${Math.round(level * 100)}%`} bg="green.400" />
            </Box>
          </Box>
        </Box>
      )}

      {deviceError && (
        <Text mt={2} fontSize="xs" color="red.500">
          {deviceError}
        </Text>
      )}

      {/* Hidden audio element to play remote stream */}
      <audio id="mg-wa-call-audio" autoPlay playsInline />
    </Box>
  );
}
