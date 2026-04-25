import { onCleanup, onMount } from "solid-js";
import { signalRService } from "../../services/signalr/SignalRService";
import { sessionState } from "../../stores/session.store";
import {
  diceRequestsState,
  setDiceRequestsState,
} from "../../stores/diceRequests.store";
import type { GameMessage } from "../../types/multiplayer";

interface RollRequestedPayload {
  requestId: string;
  diceType: "d20";
  label: string | null;
  forcedValue: number;
}

interface RollRequestedDmEchoPayload {
  requestId: string;
  diceType: "d20";
  label: string | null;
  targetUserIds: string[];
  expectedCount: number;
}

interface RollRequestedPublicPayload {
  requestId: string;
  diceType: "d20";
  label: string | null;
  targetUserIds: string[];
  expectedCount: number;
}

interface RollResultBroadcastPayload {
  requestId: string;
  userId: string;
  userName: string | null;
  diceType: "d20";
  value: number;
  label: string | null;
  requestComplete: boolean;
}

interface RollCanceledPayload {
  requestId: string;
  label: string | null;
  stillPendingUserIds: string[];
}

export default function DiceRequestListener() {
  onMount(() => {
    const onRollRequested = (message: GameMessage<RollRequestedPayload>) => {
      const p = message.payload;
      const meUserId = sessionState.hubUserId;
      if (!meUserId) {
        console.warn(
          "[DiceRequestListener] RollRequested arrived before hubUserId was set",
          { requestId: p.requestId }
        );
        return;
      }
      // This event reaches the targeted player only.
      setDiceRequestsState(p.requestId, {
        requestId: p.requestId,
        diceType: p.diceType,
        label: p.label,
        targetUserIds: [meUserId],
        dmUserId: "",
        status: "pending",
        expectedCount: 1,
        forcedValue: p.forcedValue,
        myParticipation: "waiting",
        results: {},
        createdAt: Date.now(),
      });
    };

    const onDmEcho = (message: GameMessage<RollRequestedDmEchoPayload>) => {
      const p = message.payload;
      const meUserId = sessionState.hubUserId;
      if (!meUserId) {
        console.warn(
          "[DiceRequestListener] RollRequestedDmEcho arrived before hubUserId was set",
          { requestId: p.requestId }
        );
        return;
      }
      if (diceRequestsState[p.requestId]) {
        // Already populated (e.g. from Public event dedupe chain). Update metadata.
        setDiceRequestsState(p.requestId, {
          targetUserIds: p.targetUserIds,
          expectedCount: p.expectedCount,
          dmUserId: meUserId,
        });
        return;
      }
      setDiceRequestsState(p.requestId, {
        requestId: p.requestId,
        diceType: p.diceType,
        label: p.label,
        targetUserIds: p.targetUserIds,
        dmUserId: meUserId,
        status: "pending",
        expectedCount: p.expectedCount,
        forcedValue: null,
        myParticipation: "not-target",
        results: {},
        createdAt: Date.now(),
      });
    };

    const onPublic = (message: GameMessage<RollRequestedPublicPayload>) => {
      const p = message.payload;
      // Dedupe: if a dedicated event already populated this requestId, drop.
      if (diceRequestsState[p.requestId]) return;
      setDiceRequestsState(p.requestId, {
        requestId: p.requestId,
        diceType: p.diceType,
        label: p.label,
        targetUserIds: p.targetUserIds,
        dmUserId: "",
        status: "pending",
        expectedCount: p.expectedCount,
        forcedValue: null,
        myParticipation: "not-target",
        results: {},
        createdAt: Date.now(),
      });
    };

    const onResult = (message: GameMessage<RollResultBroadcastPayload>) => {
      const p = message.payload;
      const existing = diceRequestsState[p.requestId];
      if (!existing) {
        // Race: rejoin replay can deliver RollResultBroadcast before its
        // matching RollRequestedDmEcho/Public lands. Surface in devtools so
        // the failure mode is at least visible during smoke testing.
        console.warn("[DiceRequestListener] RollResultBroadcast for unknown request", {
          requestId: p.requestId,
          userId: p.userId,
        });
        return;
      }
      setDiceRequestsState(p.requestId, "results", p.userId, {
        value: p.value,
        userName: p.userName ?? p.userId,
        rolledAt: Date.now(),
      });
      if (p.requestComplete) {
        setDiceRequestsState(p.requestId, "status", "completed");
      }
    };

    const onCanceled = (message: GameMessage<RollCanceledPayload>) => {
      const p = message.payload;
      if (!diceRequestsState[p.requestId]) {
        console.warn("[DiceRequestListener] RollCanceled for unknown request", {
          requestId: p.requestId,
        });
        return;
      }
      setDiceRequestsState(p.requestId, "status", "canceled");
    };

    signalRService.on("RollRequested", onRollRequested);
    signalRService.on("RollRequestedDmEcho", onDmEcho);
    signalRService.on("RollRequestedPublic", onPublic);
    signalRService.on("RollResultBroadcast", onResult);
    signalRService.on("RollCanceled", onCanceled);

    // Ask the server to replay any pending roll requests now that we have
    // listeners bound and hubUserId is in the store. The hub used to do this
    // automatically on connect, but the events raced our listener mount and
    // the sessionState.hubUserId hydration — SignalR dropped them with
    // "No client method with the name 'rollrequested' found".
    const tryReplay = async () => {
      // Wait up to 1s for hubUserId to land. Set by syncHubUserId() inside
      // ensureMultiplayerHandlersRegistered which runs slightly after
      // signalRService.connect resolves.
      for (let attempt = 0; attempt < 20; attempt++) {
        if (sessionState.hubUserId) break;
        await new Promise((r) => setTimeout(r, 50));
      }
      if (!sessionState.hubUserId) {
        console.warn("[DiceRequestListener] hubUserId never landed; skipping replay");
        return;
      }
      try {
        await signalRService.invoke("RequestRollReplay");
      } catch (err) {
        console.warn("[DiceRequestListener] RequestRollReplay failed", err);
      }
    };
    void tryReplay();

    onCleanup(() => {
      signalRService.off("RollRequested", onRollRequested);
      signalRService.off("RollRequestedDmEcho", onDmEcho);
      signalRService.off("RollRequestedPublic", onPublic);
      signalRService.off("RollResultBroadcast", onResult);
      signalRService.off("RollCanceled", onCanceled);
    });
  });

  return null;
}
