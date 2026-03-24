import React from "react";
import { render, waitFor } from "@testing-library/react";
import usePlayNotification from "@/admin/whatsapp/hooks/usePlayNotification";
import type { Conversation } from "@/admin/whatsapp/types";

// Test harness component invoking the hook
function Harness(props: {
  conversations: Conversation[];
  isValidating: boolean;
  audioUrl?: string;
  volume?: number;
}) {
  usePlayNotification(props);
  return null;
}

// Mock Audio API via constructor + instance
let playMock: jest.Mock;
let audioCtorMock: jest.Mock;

describe("usePlayNotification", () => {
  const realAudio = (global as any).Audio;

  beforeEach(() => {
    playMock = jest.fn().mockResolvedValue(undefined);
    audioCtorMock = jest.fn().mockImplementation((src?: string) => ({
      src,
      preload: "",
      volume: 1,
      currentTime: 0,
      play: playMock,
    }));
    (global as any).Audio = audioCtorMock;
    jest.clearAllMocks();
  });

  afterEach(() => {
    (global as any).Audio = realAudio;
  });

  const makeConv = (
    id: string,
    startedAt: string,
    messageTimestamps: string[] = []
  ): Conversation => ({
    conversationId: id,
    whatsappId: "1234567890",
    businessWhatsappId: "16463311785",
    leadName: "Lead",
    startedAt,
    source: "whatsapp",
    messages: messageTimestamps.map((ts, idx) => ({
      timestamp: ts,
      sender: "user",
      text: `m${idx}`,
      type: "text",
      direction: "inbound",
    })),
    scheduleRequests: [],
  });

  it("does not play on first load", () => {
    const T1 = "2025-01-01T00:00:00.000Z";
    const conversations = [makeConv("c1", T1)];

    render(<Harness conversations={conversations} isValidating={false} />);

    expect(playMock).toHaveBeenCalledTimes(0);
  });

  it("plays when revalidation brings newer data", () => {
    const T1 = "2025-01-01T00:00:00.000Z";
    const T2 = "2025-01-01T00:00:10.000Z";
    const c1 = makeConv("c1", T1);

    const { rerender } = render(<Harness conversations={[c1]} isValidating={false} />);

    // Start revalidation; baseline captured
    rerender(<Harness conversations={[c1]} isValidating />);

    // Newer data arrives (can still be validating or not); should play once
    const c1New = makeConv("c1", T1, [T2]);
    rerender(<Harness conversations={[c1New]} isValidating={false} />);

    return waitFor(() => expect(playMock).toHaveBeenCalledTimes(1));
  });

  it("does not play when revalidation has no newer data", () => {
    const T1 = "2025-01-01T00:00:00.000Z";
    const c1 = makeConv("c1", T1);

    const { rerender } = render(<Harness conversations={[c1]} isValidating={false} />);

    // Start revalidation; baseline captured
    rerender(<Harness conversations={[c1]} isValidating />);

    // No changes in data
    rerender(<Harness conversations={[c1]} isValidating={false} />);

    expect(playMock).toHaveBeenCalledTimes(0);
  });

  it("does not play when updates are outbound-only", () => {
    const T1 = "2025-01-01T00:00:00.000Z";
    const T2 = "2025-01-01T00:00:10.000Z";
    const c1 = makeConv("c1", T1);

    const { rerender } = render(<Harness conversations={[c1]} isValidating={false} />);

    // Start revalidation; baseline captured
    rerender(<Harness conversations={[c1]} isValidating />);

    // Outbound-only message should not trigger sound
    const outboundOnly: Conversation = {
      ...c1,
      messages: [
        {
          timestamp: T2,
          sender: "agent",
          text: "hello",
          type: "text",
          direction: "outbound",
        },
      ],
    };
    rerender(<Harness conversations={[outboundOnly]} isValidating={false} />);

    expect(playMock).toHaveBeenCalledTimes(0);
  });

  it("respects custom audioUrl and volume", () => {
    const T1 = "2025-01-01T00:00:00.000Z";
    const T2 = "2025-01-01T00:00:10.000Z";
    const c1 = makeConv("c1", T1);
    const customUrl = "/custom.mp3";
    const customVolume = 0.3;

    const { rerender } = render(
      <Harness
        conversations={[c1]}
        isValidating={false}
        audioUrl={customUrl}
        volume={customVolume}
      />
    );

    rerender(
      <Harness conversations={[c1]} isValidating audioUrl={customUrl} volume={customVolume} />
    );

    const c1New = makeConv("c1", T1, [T2]);
    rerender(
      <Harness
        conversations={[c1New]}
        isValidating={false}
        audioUrl={customUrl}
        volume={customVolume}
      />
    );

    return waitFor(() => expect(playMock).toHaveBeenCalledTimes(1)).then(() => {
      // Verify constructor was called with customUrl and volume set on the instance
      expect(audioCtorMock).toHaveBeenCalledWith(customUrl);
      const instance = (audioCtorMock as jest.Mock).mock.results[0].value as any;
      expect(instance.volume).toBeCloseTo(customVolume);
      expect(instance.src).toBe(customUrl);
    });
  });
});
