import React, { useMemo, useState } from "react";
import { View, TextInput, useWindowDimensions, Pressable } from "react-native";
import {
  Search,
  Bookmark,
  ArrowUpRight,
  ArrowRight,
  SlidersHorizontal,
  Radar,
  Info,
  Sparkles,
} from "lucide-react-native";
import type { Trend } from "@tubepilot/contracts";
import { useApp } from "../state";
import { api } from "../api";
import {
  Badge,
  Button,
  Card,
  Chip,
  Empty,
  Heading,
  ModalShell,
  PageHeading,
  Row,
  Select,
  Txt,
} from "../components/ui";
import { Score, VideoVisual } from "../components/visuals";
export function Trends() {
  const { data, theme, refresh, notify, startStudio } = useApp();
  const { width } = useWindowDimensions();
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("All topics"),
    [onlySaved, setOnlySaved] = useState(false),
    [sort, setSort] = useState("fit"),
    [selected, setSelected] = useState<Trend | null>(null);
  const categories = [
    "All topics",
    "AI & Technology",
    "Creator economy",
    "Productivity",
    "Design",
  ];
  const list = useMemo(
    () =>
      data?.trends
        .filter(
          (t) =>
            (!onlySaved || t.saved) &&
            (category === "All topics" || t.category === category) &&
            `${t.title} ${t.tags.join(" ")} ${t.summary}`
              .toLowerCase()
              .includes(search.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "fit"
            ? b.score - a.score
            : sort === "growth"
              ? b.growth - a.growth
              : a.title.localeCompare(b.title),
        ) ?? [],
    [data, category, onlySaved, search, sort],
  );
  const save = async (trend: Trend) => {
    try {
      await api(`/trends/${trend.id}/save`, "POST", { saved: !trend.saved });
      await refresh();
      notify(
        trend.saved
          ? "Removed from your saved trends."
          : "Saved to your radar.",
      );
      setSelected((s) =>
        s?.id === trend.id ? { ...s, saved: !trend.saved } : s,
      );
    } catch (e) {
      notify((e as Error).message);
    }
  };
  return (
    <View>
      <PageHeading
        eyebrow="DISCOVER WHAT’S NEXT"
        title="Stay curious. Get ahead."
        description="Fresh directions, thoughtful angles, and ideas worth making your own."
        action={
          <Button
            variant="secondary"
            icon={Bookmark}
            onPress={() => setOnlySaved(!onlySaved)}
          >
            {onlySaved
              ? "Show all trends"
              : `Saved${data?.trends.filter((t) => t.saved).length ? " · " + data.trends.filter((t) => t.saved).length : ""}`}
          </Button>
        }
      />
      <Row
        style={{
          padding: 14,
          backgroundColor: theme.purpleBg,
          borderRadius: 10,
          marginBottom: 24,
          alignItems: "flex-start",
        }}
      >
        <Info size={15} color={theme.purple} />
        <Txt size={11} color={theme.purple} style={{ flex: 1, lineHeight: 18 }}>
          You’re exploring a demo collection. Scores and growth figures are
          illustrative—not live demand, predictions, or guarantees.
        </Txt>
      </Row>
      <Row gap={12} style={{ marginBottom: 20, flexWrap: "wrap" }}>
        <Row
          style={{
            flex: 1,
            minWidth: 230,
            backgroundColor: theme.input,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 9,
            paddingHorizontal: 13,
            height: 44,
          }}
        >
          <Search size={16} color={theme.muted} />
          <TextInput
            accessibilityLabel="Search trends"
            placeholder="Find a topic, tool, or a little inspiration…"
            placeholderTextColor={theme.faint}
            value={search}
            onChangeText={setSearch}
            style={{
              flex: 1,
              fontSize: 12,
              color: theme.text,
              paddingVertical: 12,
            }}
          />
        </Row>
        <View style={{ width: 170 }}>
          <Select
            value={sort}
            options={[
              { label: "Highest sample fit", value: "fit" },
              { label: "Sample growth", value: "growth" },
              { label: "Alphabetical", value: "title" },
            ]}
            onChange={setSort}
          />
        </View>
      </Row>
      <Row gap={8} style={{ flexWrap: "wrap", marginBottom: 24 }}>
        {categories.map((c) => (
          <Chip key={c} active={c === category} onPress={() => setCategory(c)}>
            {c}
          </Chip>
        ))}
      </Row>
      <Row style={{ justifyContent: "space-between", marginBottom: 15 }}>
        <Txt size={11} muted>
          {list.length} {onlySaved ? "saved " : ""}opportunities to explore
        </Txt>
        <Row gap={5}>
          <View
            style={{
              width: 5,
              height: 5,
              borderRadius: 3,
              backgroundColor: theme.accent,
            }}
          />
          <Txt size={10} muted>
            Sample collection
          </Txt>
        </Row>
      </Row>
      {!list.length ? (
        <Card>
          <Empty
            icon={Radar}
            title="A little too quiet on this radar"
            description="Try another topic or save an opportunity to find it here."
            action="Clear filters"
            onAction={() => {
              setSearch("");
              setCategory("All topics");
              setOnlySaved(false);
            }}
          />
        </Card>
      ) : (
        <Row gap={18} style={{ alignItems: "stretch", flexWrap: "wrap" }}>
          {list.map((trend) => (
            <Card
              key={trend.id}
              style={{
                width: width > 1250 ? "31.8%" : width > 800 ? "48%" : "100%",
                flexGrow: 1,
                minWidth: 255,
                padding: 14,
                gap: 15,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Explore ${trend.title}`}
                onPress={() => setSelected(trend)}
              >
                <VideoVisual kind={trend.visual} />
              </Pressable>
              <View style={{ paddingHorizontal: 3, gap: 12 }}>
                <Row style={{ justifyContent: "space-between" }}>
                  <Badge
                    dot
                    color={
                      trend.state === "Hot"
                        ? "#edb487"
                        : trend.state === "Rising"
                          ? theme.purple
                          : theme.positive
                    }
                  >
                    {trend.state}
                  </Badge>
                  <Button
                    small
                    label={
                      trend.saved
                        ? `Unsave ${trend.title}`
                        : `Save ${trend.title}`
                    }
                    icon={Bookmark}
                    variant={trend.saved ? "primary" : "ghost"}
                    onPress={() => void save(trend)}
                  />
                </Row>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSelected(trend)}
                >
                  <Heading
                    size={17}
                    style={{
                      minHeight: 46,
                      lineHeight: 24,
                      letterSpacing: -0.3,
                    }}
                  >
                    {trend.title}
                  </Heading>
                </Pressable>
                <Txt
                  muted
                  size={11}
                  numberOfLines={3}
                  style={{ lineHeight: 19, minHeight: 57 }}
                >
                  {trend.summary}
                </Txt>
                <Row gap={6} style={{ flexWrap: "wrap" }}>
                  {trend.tags.slice(0, 2).map((tag) => (
                    <View
                      key={tag}
                      style={{
                        paddingHorizontal: 7,
                        paddingVertical: 3,
                        borderRadius: 4,
                        backgroundColor: theme.cardAlt,
                      }}
                    >
                      <Txt size={9} muted>
                        {tag}
                      </Txt>
                    </View>
                  ))}
                </Row>
                <Row
                  style={{
                    justifyContent: "space-between",
                    paddingTop: 13,
                    borderTopWidth: 1,
                    borderTopColor: theme.border,
                  }}
                >
                  <Row gap={8}>
                    <Score value={trend.score} />
                    <View>
                      <Txt size={10} weight="500">
                        Sample fit
                      </Txt>
                      <Row gap={3}>
                        <ArrowUpRight size={10} color={theme.positive} />
                        <Txt size={9} color={theme.positive}>
                          +{trend.growth}% sample growth
                        </Txt>
                      </Row>
                    </View>
                  </Row>
                  <Button
                    small
                    variant="ghost"
                    icon={ArrowRight}
                    label={`Trend details ${trend.title}`}
                    onPress={() => setSelected(trend)}
                  />
                </Row>
              </View>
            </Card>
          ))}
        </Row>
      )}
      <ModalShell
        visible={!!selected}
        title="A direction worth exploring"
        subtitle="Demo opportunity · estimates are not guarantees"
        onClose={() => setSelected(null)}
      >
        {selected && (
          <>
            <VideoVisual kind={selected.visual} />
            <Row style={{ justifyContent: "space-between" }}>
              <Badge dot>{selected.state}</Badge>
              <Row>
                <Score value={selected.score} />
                <Txt size={11} muted>
                  Illustrative fit score
                </Txt>
              </Row>
            </Row>
            <Heading size={25}>{selected.title}</Heading>
            <Txt muted>{selected.summary}</Txt>
            <Card style={{ backgroundColor: theme.cardAlt, gap: 9 }}>
              <Txt size={12} weight="600">
                Why this angle?
              </Txt>
              <Txt size={12} muted>
                {selected.why}
              </Txt>
            </Card>
            <Txt size={11} muted>
              Source: TubePilot’s fictional demo collection. No live YouTube or
              trend-source query has been made. Validate demand and add your own
              first-hand perspective.
            </Txt>
            <Row style={{ justifyContent: "space-between" }}>
              <Button
                variant="secondary"
                icon={Bookmark}
                onPress={() => void save(selected)}
              >
                {selected.saved ? "Saved" : "Save for later"}
              </Button>
              <Button
                icon={Sparkles}
                onPress={() => {
                  startStudio(selected.title);
                  setSelected(null);
                }}
              >
                Make it an idea
              </Button>
            </Row>
          </>
        )}
      </ModalShell>
    </View>
  );
}
