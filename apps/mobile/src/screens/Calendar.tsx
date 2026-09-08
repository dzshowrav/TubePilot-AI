import React, { useState } from "react";
import { View, Pressable, useWindowDimensions } from "react-native";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowRight,
  X,
  Clock,
} from "lucide-react-native";
import type { Project } from "@tubepilot/contracts";
import { stageLabels } from "@tubepilot/contracts";
import { useApp } from "../state";
import { api } from "../api";
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Heading,
  ModalShell,
  PageHeading,
  Row,
  Select,
  Txt,
} from "../components/ui";
const dateKey = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
export function Calendar() {
  const { data, theme, refresh, notify, openProject, startStudio } = useApp();
  const { width } = useWindowDimensions();
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: data?.profile.timezone ?? "UTC",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const part = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  const today = new Date(part("year"), part("month") - 1, part("day"), 12);
  const [month, setMonth] = useState(
      new Date(today.getFullYear(), today.getMonth(), 1),
    ),
    [selected, setSelected] = useState(
      dateKey(today.getFullYear(), today.getMonth(), today.getDate()),
    ),
    [planning, setPlanning] = useState(false),
    [projectId, setProjectId] = useState(""),
    [date, setDate] = useState(selected),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(),
    start = month.getDay(),
    cells = Math.ceil((start + days) / 7) * 7;
  const daily = data?.projects.filter((p) => p.scheduledFor === selected) ?? [],
    total =
      data?.projects.filter((p) =>
        p.scheduledFor?.startsWith(
          dateKey(month.getFullYear(), month.getMonth(), 1).slice(0, 7),
        ),
      ).length ?? 0;
  const plan = (value = selected) => {
    setProjectId(data?.projects[0]?.id ?? "");
    setDate(value);
    setError("");
    setPlanning(true);
  };
  const schedule = async () => {
    setBusy(true);
    setError("");
    try {
      const project = await api<Project>(`/projects/${projectId}`);
      await api(`/projects/${projectId}`, "PATCH", {
        revision: project.revision,
        scheduledFor: date,
      });
      setSelected(date);
      setPlanning(false);
      await refresh();
      notify("A little intention, added to your calendar.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const unschedule = async (project: Project) => {
    try {
      await api(`/projects/${project.id}`, "PATCH", {
        revision: project.revision,
        scheduledFor: null,
      });
      await refresh();
      notify("Removed from the calendar. Your project is still saved.");
    } catch (e) {
      notify((e as Error).message);
    }
  };
  return (
    <View>
      <PageHeading
        eyebrow="MAKE ROOM TO CREATE"
        title="A plan, not more pressure."
        description="Give your ideas a little structure. Leave room for the unexpected."
        action={
          <Button icon={Plus} onPress={() => plan()}>
            Plan a video
          </Button>
        }
      />
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <Row
          style={{
            padding: 22,
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <Row>
            <Button
              icon={ChevronLeft}
              variant="ghost"
              label="Previous month"
              onPress={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            />
            <Heading size={20} style={{ minWidth: 175 }}>
              {month.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </Heading>
            <Button
              icon={ChevronRight}
              variant="ghost"
              label="Next month"
              onPress={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            />
          </Row>
          <Row>
            <Txt size={11} muted>
              {total} {total === 1 ? "video" : "videos"} planned
            </Txt>
            <Button
              small
              variant="secondary"
              onPress={() => {
                setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                setSelected(
                  dateKey(
                    today.getFullYear(),
                    today.getMonth(),
                    today.getDate(),
                  ),
                );
              }}
            >
              Today
            </Button>
          </Row>
        </Row>
        <Row
          gap={0}
          style={{ borderTopWidth: 1, borderTopColor: theme.border }}
        >
          {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
            <View
              key={d}
              style={{
                width: "14.2857%",
                paddingVertical: 12,
                alignItems: "center",
              }}
            >
              <Txt size={9} muted weight="600">
                {d}
              </Txt>
            </View>
          ))}
        </Row>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {Array.from({ length: cells }, (_, i) => {
            const day = i - start + 1,
              valid = day >= 1 && day <= days,
              key = dateKey(month.getFullYear(), month.getMonth(), day),
              items =
                data?.projects.filter((p) => p.scheduledFor === key) ?? [],
              isToday =
                key ===
                dateKey(today.getFullYear(), today.getMonth(), today.getDate());
            return (
              <Pressable
                key={i}
                disabled={!valid}
                accessibilityRole="button"
                accessibilityLabel={
                  valid ? `Calendar ${key}` : "Empty calendar cell"
                }
                onPress={() => setSelected(key)}
                style={{
                  width: "14.2857%",
                  minHeight: width < 700 ? 78 : 122,
                  borderTopWidth: 1,
                  borderRightWidth: i % 7 === 6 ? 0 : 1,
                  borderColor: theme.border,
                  backgroundColor:
                    selected === key
                      ? theme.purpleBg
                      : valid
                        ? theme.card
                        : theme.bg,
                  padding: width < 700 ? 5 : 10,
                  gap: 7,
                }}
              >
                {valid && (
                  <>
                    <View
                      style={{
                        alignItems: "center",
                        justifyContent: "center",
                        width: 25,
                        height: 25,
                        borderRadius: 8,
                        backgroundColor: isToday ? theme.accent : undefined,
                      }}
                    >
                      <Txt
                        size={11}
                        color={isToday ? theme.accentText : theme.muted}
                        weight={isToday ? "600" : "400"}
                      >
                        {day}
                      </Txt>
                    </View>
                    {items.slice(0, 2).map((p) =>
                      width < 700 ? (
                        <View
                          key={p.id}
                          style={{
                            height: 4,
                            width: "80%",
                            borderRadius: 4,
                            backgroundColor: theme.purple,
                          }}
                        />
                      ) : (
                        <View
                          key={p.id}
                          style={{
                            padding: 6,
                            backgroundColor: theme.purple + "14",
                            borderRadius: 5,
                            borderLeftWidth: 2,
                            borderLeftColor: theme.purple,
                          }}
                        >
                          <Txt
                            size={8}
                            weight="500"
                            color={theme.purple}
                            numberOfLines={2}
                          >
                            {p.title}
                          </Txt>
                        </View>
                      ),
                    )}
                    {items.length > 2 && (
                      <Txt size={8} muted>
                        +{items.length - 2} more
                      </Txt>
                    )}
                  </>
                )}
              </Pressable>
            );
          })}
        </View>
      </Card>
      <Row
        style={{
          marginTop: 15,
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <Row>
          <View
            style={{
              height: 6,
              width: 6,
              borderRadius: 3,
              backgroundColor: theme.purple,
            }}
          />
          <Txt size={10} muted>
            Planned video
          </Txt>
        </Row>
        <Txt size={10} muted>
          Planning only · nothing is uploaded or scheduled on YouTube
        </Txt>
      </Row>
      <View style={{ marginTop: 28, gap: 15 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Heading size={18}>
            {new Date(selected + "T12:00:00").toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </Heading>
          <Button small variant="ghost" icon={Plus} onPress={() => plan()}>
            Add a plan
          </Button>
        </Row>
        {daily.length ? (
          daily.map((project) => (
            <Card key={project.id} style={{ padding: 18 }}>
              <Row style={{ flexWrap: "wrap" }}>
                <CalendarDays size={21} color={theme.purple} />
                <View style={{ flex: 1, minWidth: 170, gap: 5 }}>
                  <Txt size={13} weight="600">
                    {project.title}
                  </Txt>
                  <Txt size={10} muted>
                    {project.format} · {stageLabels[project.stage]}
                  </Txt>
                </View>
                <Button
                  small
                  variant="secondary"
                  icon={ArrowRight}
                  onPress={() => openProject(project)}
                >
                  Open project
                </Button>
                <Button
                  small
                  variant="ghost"
                  icon={X}
                  label={`Remove ${project.title} from calendar`}
                  onPress={() => void unschedule(project)}
                />
              </Row>
            </Card>
          ))
        ) : (
          <Card>
            <Row style={{ flexWrap: "wrap", justifyContent: "space-between" }}>
              <View style={{ gap: 7 }}>
                <Heading size={17}>A little breathing room.</Heading>
                <Txt size={12} muted>
                  No videos planned for this day. That can be a good thing.
                </Txt>
              </View>
              <Button variant="secondary" onPress={() => plan()}>
                Add something to look forward to
              </Button>
            </Row>
          </Card>
        )}
      </View>
      <ModalShell
        visible={planning}
        title="Give an idea a little space."
        subtitle="Choose a saved project and a day you’d like to work toward."
        width={500}
        onClose={() => setPlanning(false)}
      >
        {data?.projects.length ? (
          <>
            <Select
              label="Project"
              value={projectId}
              options={data.projects.map((p) => ({
                value: p.id,
                label: p.title,
              }))}
              onChange={setProjectId}
            />
            <Field
              label="Planned date"
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
            />
            {!!error && (
              <Txt color={theme.danger} size={12}>
                {error}
              </Txt>
            )}
            <Txt muted size={11}>
              A calendar plan is a reminder, not a publishing action. You’re
              always in control.
            </Txt>
            <Button
              icon={CalendarDays}
              loading={busy}
              onPress={() => void schedule()}
            >
              Save to calendar
            </Button>
          </>
        ) : (
          <Empty
            title="An idea comes first."
            description="Create a project, then come back to give it a date."
            action="Find my next idea"
            onAction={() => {
              setPlanning(false);
              startStudio();
            }}
          />
        )}
      </ModalShell>
    </View>
  );
}
