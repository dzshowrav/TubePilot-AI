import React, { useEffect, useMemo, useState } from "react";
import { View, TextInput, useWindowDimensions } from "react-native";
import {
  Search,
  Plus,
  LayoutGrid,
  List,
  FolderOpen,
  ArrowRight,
  Download,
  Trash2,
  Copy,
  Save,
  Sparkles,
} from "lucide-react-native";
import type { Project, ProjectInput, Stage } from "@tubepilot/contracts";
import { stageLabels, stages } from "@tubepilot/contracts";
import { useApp } from "../state";
import { api } from "../api";
import { downloadText } from "../credentials";
import {
  Badge,
  Button,
  Card,
  Chip,
  Empty,
  Field,
  Heading,
  ModalShell,
  PageHeading,
  Row,
  Select,
  Txt,
  Markdown,
} from "../components/ui";
import { ProjectCard } from "../components/project-card";
import { VideoVisual } from "../components/visuals";
const fresh: ProjectInput = {
  title: "",
  topic: "",
  format: "Long-form",
  stage: "idea",
  script: "",
  description: "",
  thumbnail: "",
  titles: [],
  scheduledFor: null,
  visual: "tools",
};
export function projectFields(p: Project): ProjectInput {
  const { id, userId, revision, createdAt, updatedAt, ...fields } = p;
  return fields;
}
export function projectMarkdown(p: ProjectInput) {
  return `# ${p.title}\n\nFormat: ${p.format}\nStage: ${stageLabels[p.stage]}\n${p.scheduledFor ? "Planned date: " + p.scheduledFor + "\n" : ""}\n## Topic\n${p.topic}\n\n## Script\n${p.script || "No script yet."}\n\n## Title options\n${p.titles.join("\n")}\n\n## Thumbnail brief\n${p.thumbnail}\n\n## Description\n${p.description}\n\n---\nCreated with TubePilot AI. Review and verify all draft content before publishing. Demo analytics are not real channel data.\n`;
}
export function Projects() {
  const { data, theme, openProject, setProject, setModal } = useApp();
  const [search, setSearch] = useState(""),
    [stage, setStage] = useState("all"),
    [view, setView] = useState("grid");
  const list = useMemo(
    () =>
      data?.projects.filter(
        (p) =>
          (stage === "all" || p.stage === stage) &&
          `${p.title} ${p.topic}`.toLowerCase().includes(search.toLowerCase()),
      ) ?? [],
    [data, search, stage],
  );
  const create = () => {
    setProject(null);
    setModal("newProject");
  };
  return (
    <View>
      <PageHeading
        eyebrow="YOUR CREATIVE WORKSPACE"
        title="Good ideas deserve a home."
        description="A little more organized. A little closer to your next upload."
        action={
          <Button icon={Plus} onPress={create}>
            New project
          </Button>
        }
      />
      <Row gap={8} style={{ marginBottom: 22, flexWrap: "wrap" }}>
        <Chip active={stage === "all"} onPress={() => setStage("all")}>
          All projects · {data?.projects.length ?? 0}
        </Chip>
        {stages.map((s) => (
          <Chip key={s} active={stage === s} onPress={() => setStage(s)}>
            {stageLabels[s]} ·{" "}
            {data?.projects.filter((p) => p.stage === s).length ?? 0}
          </Chip>
        ))}
      </Row>
      <Row style={{ marginBottom: 22, justifyContent: "space-between" }}>
        <Row
          style={{
            flex: 1,
            maxWidth: 440,
            backgroundColor: theme.input,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 9,
            paddingHorizontal: 12,
            height: 43,
          }}
        >
          <Search color={theme.muted} size={16} />
          <TextInput
            accessibilityLabel="Search projects"
            placeholder="Find something you’ve been working on…"
            placeholderTextColor={theme.faint}
            value={search}
            onChangeText={setSearch}
            style={{
              flex: 1,
              color: theme.text,
              fontSize: 12,
              paddingVertical: 12,
            }}
          />
        </Row>
        <Row gap={4}>
          <Button
            icon={LayoutGrid}
            label="Grid view"
            variant={view === "grid" ? "secondary" : "ghost"}
            onPress={() => setView("grid")}
          />
          <Button
            icon={List}
            label="List view"
            variant={view === "list" ? "secondary" : "ghost"}
            onPress={() => setView("list")}
          />
        </Row>
      </Row>
      {!list.length ? (
        <Card>
          <Empty
            icon={FolderOpen}
            title={
              search
                ? "Nothing by that name yet"
                : "Make room for your next great idea"
            }
            description={
              search
                ? "Try a different search or another project stage."
                : "Start a fresh project. A rough idea is more than enough."
            }
            action={search ? "Clear search" : "Create your first project"}
            onAction={
              search
                ? () => {
                    setSearch("");
                    setStage("all");
                  }
                : create
            }
          />
        </Card>
      ) : view === "grid" ? (
        <Row gap={17} style={{ flexWrap: "wrap", alignItems: "stretch" }}>
          {list.map((project) => (
            <View
              key={project.id}
              style={{
                minWidth: 250,
                maxWidth: 420,
                flexGrow: 1,
                flexBasis: "30%",
              }}
            >
              <ProjectCard project={project} />
            </View>
          ))}
        </Row>
      ) : (
        <Card style={{ padding: 0 }}>
          {list.map((project, i) => (
            <Row
              key={project.id}
              style={{
                padding: 17,
                borderBottomWidth: i === list.length - 1 ? 0 : 1,
                borderBottomColor: theme.border,
                flexWrap: "wrap",
              }}
            >
              <View style={{ width: 65 }}>
                <VideoVisual kind={project.visual} compact />
              </View>
              <View style={{ flex: 1, minWidth: 140, gap: 4 }}>
                <Txt weight="600" size={12}>
                  {project.title}
                </Txt>
                <Txt size={10} muted>
                  {project.format} · Updated{" "}
                  {new Date(project.updatedAt).toLocaleDateString()}
                </Txt>
              </View>
              <Badge
                color={project.stage === "ready" ? theme.accent : theme.purple}
              >
                {stageLabels[project.stage]}
              </Badge>
              <Button
                small
                icon={ArrowRight}
                variant="ghost"
                onPress={() => openProject(project)}
              >
                Open
              </Button>
            </Row>
          ))}
        </Card>
      )}
    </View>
  );
}

export function ProjectEditor() {
  const {
    project,
    setProject,
    modal,
    setModal,
    theme,
    refresh,
    notify,
    startStudio,
  } = useApp();
  const [form, setForm] = useState<ProjectInput>(fresh),
    [tab, setTab] = useState("Overview"),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false),
    [preview, setPreview] = useState(false);
  const { width } = useWindowDimensions();
  const open = modal === "project" || modal === "newProject";
  useEffect(() => {
    if (open) {
      setForm(project ? projectFields(project) : fresh);
      setTab("Overview");
      setError("");
      setPreview(false);
    }
  }, [project?.id, modal]);
  const change = <K extends keyof ProjectInput>(
    key: K,
    value: ProjectInput[K],
  ) => setForm((f) => ({ ...f, [key]: value }));
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const result = await api<Project>(
        project ? `/projects/${project.id}` : "/projects",
        project ? "PATCH" : "POST",
        { ...form, ...(project ? { revision: project.revision } : {}) },
      );
      setProject(result);
      setModal("project");
      await refresh();
      notify("Project saved. One step closer.");
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!project) return;
    try {
      await api(`/projects/${project.id}`, "DELETE");
      setConfirm(false);
      setModal(null);
      await refresh();
      notify("Project deleted.");
    } catch (e) {
      setError((e as Error).message);
      setConfirm(false);
    }
  };
  const generate = async (
    tool: "script" | "titles" | "description" | "thumbnail",
  ) => {
    const saved = await save();
    if (saved) startStudio(form.topic || form.title, tool, saved.id);
  };
  const duplicate = async () => {
    try {
      const copy = await api<Project>("/projects", "POST", {
        ...form,
        title: (form.title + " (copy)").slice(0, 180),
        scheduledFor: null,
      });
      setProject(copy);
      await refresh();
      notify("A fresh copy is ready.");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      <ModalShell
        visible={open}
        title={
          project ? "A little closer to ready." : "Start with a small idea."
        }
        subtitle={
          project
            ? "Your project · auto-generation never overwrites an unsaved edit"
            : "Create a home for your next video. You can figure out the rest as you go."
        }
        width={840}
        onClose={() => setModal(null)}
      >
        <Row gap={7} style={{ flexWrap: "wrap" }}>
          {["Overview", "Script", "Titles", "Thumbnail", "Description"].map(
            (t) => (
              <Chip
                key={t}
                active={tab === t}
                onPress={() => {
                  setTab(t);
                  setPreview(false);
                }}
              >
                {t}
              </Chip>
            ),
          )}
        </Row>
        {!!error && (
          <Txt color={theme.danger} size={12}>
            {error}
          </Txt>
        )}
        {tab === "Overview" ? (
          <>
            <Field
              label="Project title"
              value={form.title}
              onChangeText={(v) => change("title", v)}
              placeholder="A small idea with big potential…"
            />
            <Field
              label="What’s the story?"
              value={form.topic}
              onChangeText={(v) => change("topic", v)}
              multiline
              placeholder="Who is this for? What will they take away?"
            />
            <Row style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
              <View style={{ flex: 1, minWidth: 150 }}>
                <Select
                  label="Format"
                  value={form.format}
                  options={["Long-form", "Short", "Tutorial"]}
                  onChange={(v) =>
                    change("format", v as ProjectInput["format"])
                  }
                />
              </View>
              <View style={{ flex: 1, minWidth: 150 }}>
                <Select
                  label="Stage"
                  value={form.stage}
                  options={stages.map((s) => ({
                    value: s,
                    label: stageLabels[s],
                  }))}
                  onChange={(v) => change("stage", v as Stage)}
                />
              </View>
              <Field
                label="Planned date (optional)"
                value={form.scheduledFor ?? ""}
                onChangeText={(v) => change("scheduledFor", v || null)}
                placeholder="YYYY-MM-DD"
                style={{ flex: 1, minWidth: 160 }}
              />
            </Row>
            <Select
              label="Project cover style"
              value={form.visual}
              options={[
                "tools",
                "workflow",
                "creator",
                "studio",
                "coding",
                "design",
              ]}
              onChange={(v) => change("visual", v as ProjectInput["visual"])}
            />
            <Txt size={11} muted>
              Calendar dates are planning notes. This app does not upload or
              schedule videos on YouTube.
            </Txt>
          </>
        ) : (
          <>
            <Row style={{ justifyContent: "space-between" }}>
              <Txt size={12} muted>
                {tab === "Thumbnail"
                  ? "A visual concept, not an image-generation tool"
                  : `Make this ${tab.toLowerCase()} sound like you.`}
              </Txt>
              <Row>
                <Button
                  small
                  variant="ghost"
                  onPress={() => setPreview(!preview)}
                >
                  {preview ? "Edit" : "Preview"}
                </Button>
                <Button
                  small
                  variant="secondary"
                  icon={Sparkles}
                  onPress={() =>
                    void generate(
                      tab === "Titles"
                        ? "titles"
                        : tab === "Thumbnail"
                          ? "thumbnail"
                          : (tab.toLowerCase() as "script" | "description"),
                    )
                  }
                >
                  Create a draft
                </Button>
              </Row>
            </Row>
            {preview ? (
              <Card style={{ backgroundColor: theme.input }}>
                <Markdown
                  text={
                    tab === "Titles"
                      ? form.titles.join("\n\n")
                      : form[
                          tab === "Thumbnail"
                            ? "thumbnail"
                            : (tab.toLowerCase() as "script" | "description")
                        ] ||
                        "Nothing here yet. Start with a draft or write your own."
                  }
                />
              </Card>
            ) : (
              <Field
                label={
                  tab === "Titles"
                    ? "Title options (one per line)"
                    : tab === "Thumbnail"
                      ? "Thumbnail concept"
                      : `${tab} draft`
                }
                value={
                  tab === "Titles"
                    ? form.titles.join("\n")
                    : form[
                        tab === "Thumbnail"
                          ? "thumbnail"
                          : (tab.toLowerCase() as "script" | "description")
                      ]
                }
                onChangeText={(v) =>
                  tab === "Titles"
                    ? change("titles", v.split("\n").filter(Boolean))
                    : change(
                        tab === "Thumbnail"
                          ? "thumbnail"
                          : (tab.toLowerCase() as "script" | "description"),
                        v,
                      )
                }
                multiline
                placeholder="Your story. Your words. Start here…"
              />
            )}
            <Txt size={11} muted>
              Review drafts and verify factual claims before publishing. Your
              experience makes this original.
            </Txt>
          </>
        )}
        <Row
          style={{
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: theme.border,
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <Row gap={4}>
            {project && (
              <Button
                variant="ghost"
                icon={Trash2}
                label="Delete project"
                onPress={() => setConfirm(true)}
              />
            )}
            <Button
              variant="ghost"
              icon={Download}
              small
              onPress={() => {
                downloadText("tubepilot-draft.md", projectMarkdown(form));
                notify("Draft export prepared.");
              }}
            >
              Export
            </Button>
            {project && (
              <Button
                variant="ghost"
                icon={Copy}
                small
                onPress={() => void duplicate()}
              >
                Duplicate
              </Button>
            )}
          </Row>
          <Button
            icon={Save}
            loading={saving}
            disabled={!form.title.trim()}
            onPress={() => void save()}
          >
            Save project
          </Button>
        </Row>
      </ModalShell>
      <ModalShell
        visible={confirm}
        title="Delete this project?"
        subtitle="This removes the saved draft from your workspace. It cannot be undone."
        onClose={() => setConfirm(false)}
        width={420}
      >
        <Row style={{ justifyContent: "flex-end" }}>
          <Button variant="secondary" onPress={() => setConfirm(false)}>
            Keep project
          </Button>
          <Button variant="danger" icon={Trash2} onPress={() => void remove()}>
            Delete permanently
          </Button>
        </Row>
      </ModalShell>
    </>
  );
}
