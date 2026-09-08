import React, { useEffect, useState } from "react";
import { View, TextInput } from "react-native";
import {
  Sparkles,
  ArrowUp,
  ArrowUpRight,
  Plus,
  Copy,
  Check,
  MessageCircle,
  Lightbulb,
  CalendarDays,
  FileText,
  Compass,
  X,
} from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import type { Task } from "@tubepilot/contracts";
import { useApp } from "../state";
import { api } from "../api";
import { copyText } from "../credentials";
import { useGeneration } from "../use-generation";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Heading,
  Markdown,
  PageHeading,
  Progress,
  Row,
  Txt,
} from "../components/ui";
export function Assistant() {
  const { data, theme, draft, startStudio, notify } = useApp();
  const [question, setQuestion] = useState(
      draft.tool === "assistant" ? draft.topic : "",
    ),
    [expanded, setExpanded] = useState<string | null>(null);
  const g = useGeneration();
  const history = useQuery({
    queryKey: ["history", data?.profile.id],
    queryFn: () => api<Task[]>("/ai/tasks"),
    enabled: !!data,
  });
  const messages =
    history.data
      ?.filter((t) => t.tool === "assistant" && t.status === "completed")
      .slice(0, 8)
      .reverse() ?? [];
  useEffect(() => {
    if (draft.tool === "assistant") setQuestion(draft.topic);
  }, [draft.tool, draft.topic]);
  const send = (text = question) => {
    if (text.trim().length < 3) return;
    setQuestion("");
    void g.generate({
      tool: "assistant",
      topic: text,
      format: "Long-form",
      count: 3,
    });
  };
  const suggestions = [
    {
      icon: Lightbulb,
      text: "Help me find my next video idea",
      detail: "A fresh angle for your niche",
    },
    {
      icon: CalendarDays,
      text: "Make a realistic plan for this week",
      detail: "More intention, less pressure",
    },
    {
      icon: FileText,
      text: "How can I make my opening stronger?",
      detail: "Start with a little more curiosity",
    },
    {
      icon: Compass,
      text: "Help me get unstuck creatively",
      detail: "Find a small, useful next step",
    },
  ];
  return (
    <View
      style={{ maxWidth: 880, width: "100%", alignSelf: "center", gap: 22 }}
    >
      <PageHeading
        eyebrow="A THOUGHTFUL CREATIVE PARTNER"
        title="A fresh set of eyes."
        description="Talk through an idea. Find your angle. Make the next little move."
        action={
          <Badge dot color={theme.positive}>
            {data?.integrations.ai === "demo"
              ? "Template-powered demo"
              : "Configured AI"}
          </Badge>
        }
      />
      {!messages.length && !g.busy ? (
        <Card style={{ padding: 32, gap: 22 }}>
          <View style={{ alignItems: "center", gap: 16, paddingVertical: 18 }}>
            <View
              style={{
                width: 67,
                height: 67,
                borderRadius: 23,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: theme.purpleBg,
              }}
            >
              <Sparkles size={31} color={theme.purple} />
            </View>
            <Heading size={27} style={{ textAlign: "center" }}>
              What’s on your creative mind?
            </Heading>
            <Txt
              muted
              size={12}
              style={{ textAlign: "center", maxWidth: 400, lineHeight: 21 }}
            >
              You don’t need a perfect prompt. A half-formed idea and a little
              curiosity are a good place to start.
            </Txt>
          </View>
          <Row gap={12} style={{ flexWrap: "wrap" }}>
            {suggestions.map((s) => (
              <View
                key={s.text}
                style={{ flexBasis: "46%", flexGrow: 1, minWidth: 220 }}
              >
                <Card
                  style={{ padding: 17, backgroundColor: theme.input, gap: 11 }}
                >
                  <s.icon size={18} color={theme.purple} />
                  <Txt size={12} weight="500">
                    {s.text}
                  </Txt>
                  <Txt size={10} muted>
                    {s.detail}
                  </Txt>
                  <Button
                    small
                    variant="ghost"
                    icon={ArrowUpRight}
                    onPress={() => send(s.text)}
                  >
                    Let’s explore
                  </Button>
                </Card>
              </View>
            ))}
          </Row>
        </Card>
      ) : (
        <View style={{ gap: 20 }}>
          {messages.map((task) => (
            <View key={task.id} style={{ gap: 14 }}>
              <Row style={{ justifyContent: "flex-end" }}>
                <View
                  style={{
                    maxWidth: "85%",
                    padding: 16,
                    backgroundColor: theme.purpleBg,
                    borderRadius: 13,
                    borderBottomRightRadius: 3,
                  }}
                >
                  <Txt size={13}>{task.topic}</Txt>
                </View>
                <Avatar name={data?.profile.name ?? "Creator"} size={30} />
              </Row>
              <Card style={{ gap: 17, padding: 25 }}>
                <Row style={{ justifyContent: "space-between" }}>
                  <Row>
                    <Sparkles size={17} color={theme.purple} />
                    <Txt size={12} weight="600">
                      TubePilot
                    </Txt>
                    <Badge>
                      {task.result?.source === "demo"
                        ? "DEMO RESPONSE"
                        : "AI DRAFT"}
                    </Badge>
                  </Row>
                  <Button
                    small
                    variant="ghost"
                    icon={Copy}
                    label="Copy assistant response"
                    onPress={() =>
                      void copyText(task.result?.content ?? "")
                        .then(() => notify("Response copied."))
                        .catch(() =>
                          notify(
                            "Clipboard blocked. You can select the response text instead.",
                          ),
                        )
                    }
                  />
                </Row>
                {expanded === task.id || task === messages.at(-1) ? (
                  <Markdown text={task.result?.content ?? ""} />
                ) : (
                  <>
                    <Txt size={12} muted numberOfLines={3}>
                      {task.result?.content}
                    </Txt>
                    <Button
                      small
                      variant="ghost"
                      onPress={() => setExpanded(task.id)}
                    >
                      Read the full response
                    </Button>
                  </>
                )}
              </Card>
            </View>
          ))}
        </View>
      )}
      {g.busy && (
        <Card style={{ gap: 17 }}>
          <Row>
            <Sparkles size={18} color={theme.purple} />
            <Txt size={12}>
              Preparing a thoughtful{" "}
              {data?.integrations.ai === "demo" ? "demo " : ""}starting point…
            </Txt>
            <View style={{ flex: 1 }} />
            <Button
              small
              variant="ghost"
              icon={X}
              label="Cancel assistant response"
              onPress={() => void g.cancel()}
            />
          </Row>
          <Progress value={g.task?.progress ?? 8} />
        </Card>
      )}
      {!!g.error && (
        <Txt color={theme.danger} size={12}>
          {g.error}
        </Txt>
      )}
      <Card style={{ padding: 15, gap: 12 }}>
        <TextInput
          accessibilityLabel="Ask TubePilot"
          value={question}
          onChangeText={setQuestion}
          placeholder="A question, an idea, a little creative uncertainty…"
          placeholderTextColor={theme.faint}
          multiline
          style={{
            color: theme.text,
            fontSize: 13,
            lineHeight: 22,
            minHeight: 64,
            padding: 8,
          }}
        />
        <Row style={{ justifyContent: "space-between" }}>
          <Row>
            <Sparkles size={13} color={theme.muted} />
            <Txt size={10} muted>
              {data?.profile.niche} · {data?.profile.voice} voice
            </Txt>
          </Row>
          <Button
            icon={ArrowUp}
            label="Send message"
            disabled={
              g.busy ||
              question.trim().length < 3 ||
              (data?.profile.credits ?? 0) < 2
            }
            onPress={() => send()}
          />
        </Row>
      </Card>
      <Txt size={10} muted style={{ textAlign: "center", lineHeight: 18 }}>
        2 credits per response.{" "}
        {data?.integrations.ai === "demo"
          ? "This demo uses templates, not a live AI model or connected channel."
          : "AI responses can be inaccurate. Review and verify before acting."}
      </Txt>
    </View>
  );
}
