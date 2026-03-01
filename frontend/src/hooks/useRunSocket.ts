import { useCallback, useEffect, useRef } from "react";
import type { SocketMessage } from "../types";
import { useAppStore } from "../store/useAppStore";
import { buildWsUrl } from "../lib/api";

export const useRunSocket = () => {
  const wsRef = useRef<WebSocket | null>(null);
  const queueRef = useRef<SocketMessage[]>([]);
  const rafRef = useRef<number | null>(null);
  const activeRunIdRef = useRef<string | null>(null);

  const processMessage = useCallback((message: Exclude<SocketMessage, { type: "generation" }>) => {
    const state = useAppStore.getState();
    if (message.type === "run_started") {
      activeRunIdRef.current = message.run_id;
      state.setRunId(message.run_id);
      return;
    }
    if (message.type === "leaderboard") {
      if (activeRunIdRef.current && message.run_id !== activeRunIdRef.current) {
        return;
      }
      state.setLeaderboard(message.entries);
      return;
    }
    if (message.type === "completed") {
      if (activeRunIdRef.current && message.run_id !== activeRunIdRef.current) {
        return;
      }
      state.setRunSummary(message.summary);
      state.setRunning(false);
      activeRunIdRef.current = null;
      if (wsRef.current) {
        wsRef.current.close();
      }
      return;
    }
    if (message.type === "error" || message.type === "algorithm_error") {
      state.setSocketError(message.error);
      return;
    }
  }, []);

  const flushQueue = useCallback(() => {
    const queue = queueRef.current;
    if (queue.length > 0) {
      const copy = queue.splice(0, queue.length);
      const runStartedMessages = copy.filter(
        (message): message is Extract<SocketMessage, { type: "run_started" }> => message.type === "run_started"
      );
      runStartedMessages.forEach((message) => {
        processMessage(message);
      });

      const generations = copy.filter((message): message is Extract<SocketMessage, { type: "generation" }> => {
        return message.type === "generation";
      });

      if (generations.length > 0) {
        const runId = activeRunIdRef.current;
        const filtered = runId ? generations.filter((message) => message.run_id === runId) : generations;
        if (filtered.length > 0) {
          useAppStore.getState().addSnapshotsBatch(filtered);
        }
      }

      copy.forEach((message) => {
        if (message.type !== "generation" && message.type !== "run_started") {
          processMessage(message);
        }
      });
    }
    rafRef.current = window.requestAnimationFrame(flushQueue);
  }, [processMessage]);

  const stopRun = useCallback(() => {
    queueRef.current = [];
    activeRunIdRef.current = null;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    useAppStore.getState().setRunning(false);
  }, []);

  const startRun = useCallback((payload: object) => {
    stopRun();
    queueRef.current = [];
    const state = useAppStore.getState();
    state.resetRunData();
    state.setRunning(true);

    const ws = new WebSocket(buildWsUrl("/ws/run"));
    wsRef.current = ws;
    const thisSocket = ws;

    ws.onopen = () => {
      useAppStore.getState().setSocketError(null);
      ws.send(
        JSON.stringify({
          type: "start_run",
          payload
        })
      );
    };
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as SocketMessage;
        queueRef.current.push(message);
      } catch {
        useAppStore.getState().setSocketError("Invalid message from websocket.");
      }
    };
    ws.onerror = () => {
      useAppStore.getState().setSocketError("WebSocket connection error.");
    };
    ws.onclose = () => {
      if (wsRef.current !== thisSocket) {
        return;
      }
      useAppStore.getState().setRunning(false);
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      wsRef.current = null;
    };

    if (!rafRef.current) {
      rafRef.current = window.requestAnimationFrame(flushQueue);
    }
  }, [flushQueue, stopRun]);

  useEffect(() => {
    return () => {
      stopRun();
    };
  }, [stopRun]);

  return { startRun, stopRun };
};
