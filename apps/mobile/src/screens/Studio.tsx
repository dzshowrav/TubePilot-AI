import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import {
  Sparkles,
  Lightbulb,
  FileText,
  Type,
  AlignLeft,
  Clapperboard,
  Image as ImageIcon,
  ArrowRight,
  Save,
  Copy,
  Download,
  Check,
  ArrowUpRight,
  X,
  Coins,
  History,
} from "lucide-react-native";
import type {
  Idea,
  Project,
  ProjectInput,
  TaskInput,
  Task,
  Tool,
} from "@tubepilot/contracts";
import { toolCosts, toolLabels } from "@tubepilot/contracts";
import { useApp } from "../state";
import { api } from "../api";
import { copyText, downloadText } from "../credentials";
import { useGeneration } from "../use-generation";
import {
  Badge,
  Button,
  Card,
  Chip,
  Empty,
  Field,
  Heading,
  Markdown,
  ModalShell,
  PageHeading,
  Progress,
  Row,
  Select,
  Txt,
} from "../components/ui";
const icons: Record<string, React.ComponentType<any>> = {
  ideas: Lightbulb,
  script: FileText,
  titles: Type,
  description: AlignLeft,
  shorts: Clapperboard,
  thumbnail: ImageIcon,
};
const descriptions: Record<string, string> = {
  ideas: "Find the angle only you could take.",
  script: "Give a good idea a story worth telling.",
  titles: "A better first impression, in a few words.",
  description: "Give your story a little more context.",
  shorts: "One small idea. A memorable sixty seconds.",
  thumbnail: "Help your audience see the story first.",
};
export function Studio() {
  const { data, theme, draft, startStudio, refresh, notify, openProject } =
    useApp();
  const { width } = useWindowDimensions();
  const [tool, setTool] = useState<Tool>(
      draft.tool === "assistant" ? "ideas" : draft.tool,
    ),
    [topic, setTopic] = useState(draft.topic),
    [projectId, setProjectId] = useState(draft.projectId),
    [historyOpen, setHistoryOpen] = useState(false),
    [format, setFormat] = useState<ProjectInput["format"]>("Long-form"),
    [count, setCount] = useState("5"),
    [saved, setSaved] = useState<Record<number, string>>({}),
    [saving, setSaving] = useState(false),
    [savedProject, setSavedProject] = useState<Project | null>(null);
  const generation = useGeneration();
  const history = useQuery({
    queryKey: ["history", data?.profile.id],
    queryFn: () => api<Task[]>("/ai/tasks"),
    enabled: historyOpen,
  });
  const resume = (task: Task) => {
    setTool(task.tool);
    setTopic(task.topic);
    setFormat(task.format ?? "Long-form");
    setProjectId(
      data?.projects.some((p) => p.id === task.projectId)
        ? task.projectId
        : undefined,
    );
    setSaved({});
    setSavedProject(null);
    generation.resume(task);
    setHistoryOpen(false);
  };
  useEffect(() => {
    setTool(draft.tool === "assistant" ? "ideas" : draft.tool);
    setTopic(draft.topic);
    setProjectId(draft.projectId);
    setFormat(
      data?.projects.find((p) => p.id === draft.projectId)?.format ??
        (draft.tool === "shorts" ? "Short" : "Long-form"),
    );
    generation.reset();
    setSaved({});
    setSavedProject(null);
  }, [draft.topic, draft.tool, draft.projectId]);
  const choose = (value: Tool) => {
    setTool(value);
    if (value === "shorts") setFormat("Short");
    generation.reset();
    setSavedProject(null);
  };
  const submit = () => {
    setSaved({});
    setSavedProject(null);
    void generation.generate({
      tool,
      topic,
      format,
      count: Number(count),
      ...(projectId ? { projectId } : {}),
    });
  };
  const result =
    generation.task?.status === "completed" ? generation.task.result : null;
  const saveIdea = async (idea: Idea, index: number, next = false) => {
    setSaving(true);
    try {
      let project: Project;
      if (saved[index])
        project = await api<Project>(`/projects/${saved[index]}`);
      else {
        project = await api<Project>("/projects", "POST", {
          title: idea.title,
          topic: topic + "\n\nAngle: " + idea.angle,
          format,
          stage: "idea",
          visual: topic.toLowerCase().includes("workflow")
            ? "workflow"
            : "tools",
        });
        setSaved((s) => ({ ...s, [index]: project.id }));
        await refresh();
        notify("Idea saved to your projects.");
      }
      if (next) startStudio(project.topic.split("\n")[0], "script", project.id);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const saveResult = async (title?: string, next = false) => {
    if (!result) return;
    setSaving(true);
    try {
      const current = projectId
        ? await api<Project>(`/projects/${projectId}`)
        : savedProject;
      const patch: Partial<ProjectInput> = {};
      if (tool === "script" || tool === "shorts") {
        patch.script = result.content;
        patch.stage = "scripting";
      }
      if (tool === "description") patch.description = result.content;
      if (tool === "thumbnail") patch.thumbnail = result.content;
      if (tool === "titles") {
        patch.titles = result.titles ?? [];
        patch.title = title ?? result.titles?.[0] ?? topic.slice(0, 180);
        if (current?.script) patch.stage = "ready";
      }
      const project = await api<Project>(
        current ? `/projects/${current.id}` : "/projects",
        current ? "PATCH" : "POST",
        current
          ? { ...patch, revision: current.revision }
          : { title: topic.slice(0, 180), topic, format, ...patch },
      );
      setSavedProject(project);
      await refresh();
      notify("Your draft is saved.");
      if (next)
        startStudio(
          project.topic.split("\n")[0] || project.title,
          "titles",
          project.id,
        );
      return project;
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const copy = async () => {
    try {
      await copyText(result?.content ?? "");
      notify("Copied. Make it your own.");
    } catch {
      notify(
        "Clipboard access was blocked. Select the text or export the draft.",
      );
    }
  };
  const activeProject = data?.projects.find((p) => p.id === projectId);
  return (
    <View>
      <PageHeading
        eyebrow="FROM A SPARK TO SOMETHING GREAT"
        title="A little creative momentum."
        description="Your ideas. Your voice. A thoughtful assistant for the in-between."
        action={
          <Button
            icon={History}
            variant="secondary"
            disabled={generation.busy}
            onPress={() => setHistoryOpen(true)}
          >
            Recent drafts
          </Button>
        }
      />
      <Row gap={8} style={{ flexWrap: "wrap", marginBottom: 24 }}>
        {(
          [
            "ideas",
            "script",
            "titles",
            "description",
            "shorts",
            "thumbnail",
          ] as Tool[]
        ).map((t) => (
          <Chip
            key={t}
            icon={icons[t]}
            active={tool === t}
            onPress={() => !generation.busy && choose(t)}
          >
            {toolLabels[t]}
          </Chip>
        ))}
      </Row>
      <Row gap={22} style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
        <Card
          style={{ width: width > 1100 ? 340 : "100%", gap: 21, padding: 24 }}
        >
          <Row>
            <View
              style={{
                width: 37,
                height: 37,
                borderRadius: 11,
                backgroundColor: theme.purpleBg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sparkles size={19} color={theme.purple} />
            </View>
            <View>
              <Heading size={18}>{toolLabels[tool]}</Heading>
              <Txt size={10} muted>
                {descriptions[tool]}
              </Txt>
            </View>
          </Row>
          {activeProject && (
            <Badge>Working on: {activeProject.title.slice(0, 35)}</Badge>
          )}
          <Field
            label="What’s on your mind?"
            value={topic}
            onChangeText={setTopic}
            multiline
            placeholder="A topic, a question, an idea you can’t stop thinking about…"
            disabled={generation.busy}
          />
          <View style={{ gap: 9 }}>
            <Txt size={9} muted>
              OR START WITH A LITTLE INSPIRATION
            </Txt>
            <Row gap={6} style={{ flexWrap: "wrap" }}>
              {[
                "AI agents for beginners",
                "A calmer creative workflow",
                "My one-person business",
              ].map((text) => (
                <Chip
                  key={text}
                  onPress={() => !generation.busy && setTopic(text)}
                >
                  {text}
                </Chip>
              ))}
            </Row>
          </View>
          <Row style={{ alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <Select
                label="Video format"
                value={format}
                options={
                  tool === "shorts"
                    ? ["Short"]
                    : ["Long-form", "Short", "Tutorial"]
                }
                onChange={(v) => setFormat(v as ProjectInput["format"])}
              />
            </View>
            {["ideas", "titles"].includes(tool) && (
              <View style={{ width: 88 }}>
                <Select
                  label="Options"
                  value={count}
                  options={["3", "5", "10"]}
                  onChange={setCount}
                />
              </View>
            )}
          </Row>
          <View
            style={{
              gap: 11,
              borderTopWidth: 1,
              borderTopColor: theme.border,
              paddingTop: 17,
            }}
          >
            <Row style={{ justifyContent: "space-between" }}>
              <Txt size={10} muted>
                Brand voice
              </Txt>
              <Txt size={10} color={theme.purple}>
                {data?.profile.voice} ·{" "}
                {
                  {
                    en: "English",
                    bn: "বাংলা",
                    hi: "Hindi",
                    ar: "Arabic",
                    es: "Spanish",
                  }[data?.profile.language ?? "en"]
                }
              </Txt>
            </Row>
            <Row style={{ justifyContent: "space-between" }}>
              <Txt size={10} muted>
                Generator
              </Txt>
              <Badge color={theme.positive}>
                {data?.integrations.ai === "provider"
                  ? "Configured AI model"
                  : "Demo templates"}
              </Badge>
            </Row>
          </View>
          <Button
            icon={Sparkles}
            loading={generation.busy}
            disabled={
              topic.trim().length < 3 ||
              (data?.profile.credits ?? 0) < toolCosts[tool]
            }
            onPress={submit}
          >
            {generation.busy
              ? "A little magic in progress…"
              : `Create ${tool === "ideas" ? "video ideas" : tool === "titles" ? "title options" : "my draft"}`}
          </Button>
          <Row style={{ justifyContent: "center" }}>
            <Coins size={12} color={theme.muted} />
            <Txt size={10} muted>
              {toolCosts[tool]} credits · {data?.profile.credits} available
            </Txt>
          </Row>
          {data?.integrations.ai === "demo" && (
            <Txt
              size={10}
              muted
              style={{ lineHeight: 18, textAlign: "center" }}
            >
              Template-powered preview. Not live AI research. Every draft is a
              starting point, not a finished story.
            </Txt>
          )}
        </Card>
        <View style={{ flex: 1, minWidth: width < 700 ? 260 : 340, gap: 17 }}>
          {!!generation.error && (
            <Card style={{ borderColor: theme.danger + "66" }}>
              <Txt size={12} color={theme.danger}>
                {generation.error}
              </Txt>
            </Card>
          )}
          {generation.busy ? (
            <Card
              style={{
                padding: 35,
                gap: 26,
                minHeight: 380,
                justifyContent: "center",
              }}
            >
              <View style={{ alignItems: "center", gap: 16 }}>
                <View
                  style={{
                    width: 65,
                    height: 65,
                    borderRadius: 21,
                    backgroundColor: theme.purpleBg,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Sparkles size={30} color={theme.purple} />
                </View>
                <Heading size={23}>Giving your idea a little shape.</Heading>
                <Txt size={12} muted style={{ textAlign: "center" }}>
                  Preparing an editable{" "}
                  {data?.integrations.ai === "demo" ? "demo " : ""}draft around
                  your topic and voice.
                </Txt>
              </View>
              <Progress value={generation.task?.progress ?? 5} />
              <Row style={{ justifyContent: "space-between" }}>
                <Txt size={10} muted>
                  {generation.task?.progress ?? 5}% · Your work is saved as a
                  task
                </Txt>
                <Button
                  small
                  variant="ghost"
                  icon={X}
                  onPress={() => void generation.cancel()}
                >
                  Cancel generation
                </Button>
              </Row>
            </Card>
          ) : result ? (
            <>
              <Row
                style={{ justifyContent: "space-between", flexWrap: "wrap" }}
              >
                <View style={{ gap: 4 }}>
                  <Heading size={20}>
                    {tool === "ideas"
                      ? "A few directions to call your own."
                      : tool === "titles"
                        ? "Give your story a great first line."
                        : "Your story, starting to take shape."}
                  </Heading>
                  <Txt size={10} muted>
                    {result.source === "demo"
                      ? "Demo draft · "
                      : "AI-generated draft · "}
                    Review, edit, and verify before publishing.
                  </Txt>
                </View>
                <Row gap={0}>
                  <Button
                    small
                    icon={Copy}
                    label="Copy generated draft"
                    variant="ghost"
                    onPress={() => void copy()}
                  />
                  <Button
                    small
                    icon={Download}
                    label="Export generated draft"
                    variant="ghost"
                    onPress={() => {
                      downloadText("tubepilot-" + tool + ".md", result.content);
                      notify("Your draft export is ready.");
                    }}
                  />
                </Row>
              </Row>
              {result.ideas ? (
                result.ideas.map((idea, i) => (
                  <Card
                    key={`${generation.task?.id}-${i}`}
                    style={{ padding: 23, gap: 13 }}
                  >
                    <Row style={{ justifyContent: "space-between" }}>
                      <Badge>ANGLE {String(i + 1).padStart(2, "0")}</Badge>
                      <Txt size={9} muted>
                        {idea.format}
                      </Txt>
                    </Row>
                    <Heading size={20} style={{ lineHeight: 28 }}>
                      {idea.title}
                    </Heading>
                    <Txt size={12} color={theme.purple}>
                      {idea.hook}
                    </Txt>
                    <Txt size={12} muted>
                      {idea.angle}
                    </Txt>
                    <Row
                      style={{ justifyContent: "space-between", marginTop: 4 }}
                    >
                      <Button
                        small
                        icon={saved[i] ? Check : Save}
                        variant="ghost"
                        disabled={!!saved[i] || saving}
                        onPress={() => void saveIdea(idea, i)}
                      >
                        {saved[i] ? "Saved" : "Save idea"}
                      </Button>
                      <Button
                        small
                        icon={ArrowRight}
                        variant="secondary"
                        disabled={saving}
                        onPress={() => void saveIdea(idea, i, true)}
                      >
                        Write the script
                      </Button>
                    </Row>
                  </Card>
                ))
              ) : result.titles ? (
                <View style={{ gap: 10 }}>
                  {result.titles.map((title, i) => (
                    <Card key={i} style={{ padding: 19, gap: 14 }}>
                      <Row>
                        <Txt size={12} color={theme.purple} weight="600">
                          {String(i + 1).padStart(2, "0")}
                        </Txt>
                        <Txt style={{ flex: 1, lineHeight: 23 }} weight="500">
                          {title}
                        </Txt>
                      </Row>
                      <Row style={{ justifyContent: "space-between" }}>
                        <Txt size={9} muted>
                          {title.length} characters · draft, not a CTR
                          prediction
                        </Txt>
                        <Button
                          small
                          variant="secondary"
                          icon={Check}
                          disabled={saving}
                          onPress={() => void saveResult(title)}
                        >
                          Use this title
                        </Button>
                      </Row>
                    </Card>
                  ))}
                </View>
              ) : (
                <Card style={{ gap: 25, padding: 28 }}>
                  <Markdown text={result.content} />
                  <View
                    style={{
                      paddingTop: 20,
                      borderTopWidth: 1,
                      borderTopColor: theme.border,
                      gap: 10,
                    }}
                  >
                    {activeProject && (
                      <Txt size={10} muted>
                        Saving replaces the{" "}
                        {tool === "shorts" ? "script" : tool} draft in “
                        {activeProject.title}”. Export your current version
                        first if you’d like to keep it.
                      </Txt>
                    )}
                    <Row
                      style={{
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                      }}
                    >
                      <Button
                        variant="secondary"
                        icon={Save}
                        loading={saving}
                        onPress={() => void saveResult()}
                      >
                        {savedProject ? "Save again" : "Save to project"}
                      </Button>
                      {tool === "script" && (
                        <Button
                          icon={ArrowRight}
                          disabled={saving}
                          onPress={() => void saveResult(undefined, true)}
                        >
                          Find the right title
                        </Button>
                      )}
                    </Row>
                  </View>
                </Card>
              )}
              {savedProject && (
                <Card style={{ backgroundColor: theme.purpleBg, gap: 13 }}>
                  <Row>
                    <Check size={17} color={theme.purple} />
                    <Txt size={12} style={{ flex: 1 }}>
                      Saved to “{savedProject.title}”
                    </Txt>
                    <Button
                      small
                      variant="ghost"
                      icon={ArrowUpRight}
                      onPress={() => openProject(savedProject)}
                    >
                      Open project
                    </Button>
                  </Row>
                </Card>
              )}
            </>
          ) : (
            !generation.error && (
              <Card
                style={{
                  minHeight: 485,
                  justifyContent: "center",
                  padding: 25,
                }}
              >
                <Empty
                  icon={icons[tool]}
                  title="Every great video starts somewhere."
                  description="A rough topic. A question. A tiny spark of curiosity. Add yours on the left, and let’s see where it goes."
                />
                <View
                  style={{
                    flexDirection: "row",
                    gap: 8,
                    alignSelf: "center",
                    marginTop: 12,
                  }}
                >
                  {["Your idea", "A new angle", "Something great"].map(
                    (t, i) => (
                      <React.Fragment key={t}>
                        {i > 0 && (
                          <ArrowRight
                            size={12}
                            color={theme.faint}
                            style={{ marginTop: 6 }}
                          />
                        )}
                        <Txt size={10} muted style={{ padding: 5 }}>
                          {t}
                        </Txt>
                      </React.Fragment>
                    ),
                  )}
                </View>
              </Card>
            )
          )}
        </View>
      </Row>
      <ModalShell
        visible={historyOpen}
        title="Your recent creative threads."
        subtitle="Reopen a saved generation. No new request or credit charge."
        onClose={() => setHistoryOpen(false)}
        width={620}
      >
        {history.isLoading ? (
          <Txt muted>Opening your draft history…</Txt>
        ) : history.error ? (
          <Txt color={theme.danger}>{history.error.message}</Txt>
        ) : history.data?.filter((task) => task.tool !== "assistant").length ? (
          history.data
            .filter((task) => task.tool !== "assistant")
            .map((task) => (
              <Card key={task.id} style={{ padding: 16, gap: 12 }}>
                <Row style={{ justifyContent: "space-between" }}>
                  <Badge>{toolLabels[task.tool]}</Badge>
                  <Txt size={10} muted>
                    {task.status}
                  </Txt>
                </Row>
                <Txt size={13} weight="500" numberOfLines={2}>
                  {task.topic}
                </Txt>
                <Row style={{ justifyContent: "space-between" }}>
                  <Txt size={10} muted>
                    {new Date(task.createdAt).toLocaleDateString()} ·{" "}
                    {task.credits} credits
                  </Txt>
                  <Button
                    small
                    variant="secondary"
                    icon={ArrowRight}
                    onPress={() => resume(task)}
                  >
                    Reopen draft
                  </Button>
                </Row>
              </Card>
            ))
        ) : (
          <Empty
            icon={History}
            title="The first page is still yours."
            description="Your generated drafts will be saved here automatically."
          />
        )}
      </ModalShell>
    </View>
  );
}
