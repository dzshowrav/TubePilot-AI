import React from "react";
import { View, Pressable } from "react-native";
import { MoreHorizontal, Clock, CalendarDays } from "lucide-react-native";
import type { Project } from "@tubepilot/contracts";
import { stageLabels } from "@tubepilot/contracts";
import { useApp } from "../state";
import { VideoVisual } from "./visuals";
import { Badge, Txt, Row, Button } from "./ui";
export function ProjectCard({ project }: { project: Project }) {
  const { theme, openProject } = useApp();
  const color = {
    idea: theme.purple,
    scripting: "#efbb85",
    ready: theme.accent,
    published: "#88c4c5",
  }[project.stage];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open project ${project.title}`}
      onPress={() => openProject(project)}
      style={({ hovered }: any) => ({
        flex: 1,
        minWidth: 200,
        padding: 12,
        borderWidth: 1,
        borderColor: hovered ? theme.purple + "70" : theme.border,
        borderRadius: 13,
        backgroundColor: theme.card,
        gap: 13,
      })}
    >
      <VideoVisual kind={project.visual} />
      <View style={{ gap: 12, paddingHorizontal: 3, paddingBottom: 4 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Badge color={color} dot>
            {stageLabels[project.stage]}
          </Badge>
          <Txt size={9} muted>
            {project.format}
          </Txt>
        </Row>
        <Txt
          weight="600"
          size={13}
          numberOfLines={2}
          style={{ minHeight: 39, lineHeight: 20 }}
        >
          {project.title}
        </Txt>
        <Row style={{ justifyContent: "space-between" }}>
          <Row gap={5}>
            {project.scheduledFor ? (
              <CalendarDays size={11} color={theme.muted} />
            ) : (
              <Clock size={11} color={theme.muted} />
            )}
            <Txt size={10} muted>
              {project.scheduledFor
                ? new Date(
                    project.scheduledFor + "T12:00:00",
                  ).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                : "Edited " +
                  new Date(project.updatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
            </Txt>
          </Row>
          <MoreHorizontal size={15} color={theme.muted} />
        </Row>
      </View>
    </Pressable>
  );
}
