import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Task, TaskInput } from "@tubepilot/contracts";
import { api, requestKey } from "./api";
import { useApp } from "./state";
export function useGeneration() {
  const { refresh, client } = useApp();
  const [id, setId] = useState<string | null>(null),
    [submitting, setSubmitting] = useState(false),
    [error, setError] = useState("");
  const observed = useRef("");
  const query = useQuery({
    queryKey: ["task", id],
    queryFn: () => api<Task>(`/ai/tasks/${id}`),
    enabled: !!id,
    refetchInterval: (q) =>
      q.state.data &&
      ["completed", "failed", "cancelled"].includes(q.state.data.status)
        ? false
        : 400,
    retry: 1,
  });
  const task = query.data;
  const busy =
    submitting || task?.status === "queued" || task?.status === "running";
  useEffect(() => {
    if (
      task &&
      ["completed", "failed", "cancelled"].includes(task.status) &&
      observed.current !== task.id
    ) {
      observed.current = task.id;
      void refresh();
    }
  }, [task?.id, task?.status, refresh]);
  const generate = async (input: TaskInput) => {
    setSubmitting(true);
    setError("");
    setId(null);
    try {
      const task = await api<Task>("/ai/tasks", "POST", input, {
        "Idempotency-Key": requestKey(),
      });
      client.setQueryData(["task", task.id], task);
      setId(task.id);
      void refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };
  const cancel = async () => {
    if (!id) return;
    try {
      const result = await api<Task>(`/ai/tasks/${id}/cancel`, "POST", {});
      client.setQueryData(["task", id], result);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return {
    task,
    busy,
    error: error || query.error?.message || task?.error || "",
    generate,
    resume: (task: Task) => {
      client.setQueryData(["task", task.id], task);
      setError("");
      setId(task.id);
    },
    cancel,
    reset: () => {
      setId(null);
      setError("");
    },
  };
}
