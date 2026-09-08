import { YoutubeAnalytics } from "./Youtube";
import React, { useState } from "react";
import { View, useWindowDimensions } from "react-native";
import Svg, { Circle } from "react-native-svg";
import {
  Download,
  ArrowUpRight,
  Play,
  Users,
  MousePointer2,
  Clock,
  Info,
  ArrowRight,
  Lightbulb,
} from "lucide-react-native";
import { useApp } from "../state";
import { downloadText } from "../credentials";
import {
  Badge,
  Button,
  Card,
  Chip,
  Heading,
  PageHeading,
  Progress,
  Row,
  SectionHeading,
  Select,
  Txt,
} from "../components/ui";
import { PerformanceChart, VideoVisual } from "../components/visuals";
export function Analytics() {
  const { data } = useApp();
  return data?.youtube?.connectionId ? <YoutubeAnalytics /> : <DemoAnalytics />;
}
function DemoAnalytics() {
  const { data, theme, setModal, startStudio, notify } = useApp();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState("Overview"),
    [period, setPeriod] = useState("28");
  if (!data) return null;
  const a = data.analytics,
    days = a.series.slice(-Number(period));
  let offset = 0;
  const exportReport = () => {
    downloadText(
      "tubepilot-demo-analytics.csv",
      "date,views,watch_hours,subscribers,data_source\n" +
        days
          .map(
            (d) =>
              `${d.date},${d.views},${d.watchHours},${d.subscribers},fictional_demo`,
          )
          .join("\n"),
      "text/csv",
    );
    notify("Sample analytics report exported.");
  };
  return (
    <View>
      <PageHeading
        eyebrow="THE STORY BEHIND THE NUMBERS"
        title="A clearer view of your creative world."
        description="Understand what’s resonating. Make your next move with intention."
        action={
          <Button variant="secondary" icon={Download} onPress={exportReport}>
            Export report
          </Button>
        }
      />
      <Row
        style={{
          padding: 14,
          backgroundColor: theme.purpleBg,
          borderRadius: 10,
          marginBottom: 22,
          alignItems: "flex-start",
        }}
      >
        <Info size={15} color={theme.purple} />
        <Txt size={11} color={theme.purple} style={{ flex: 1, lineHeight: 18 }}>
          These charts use fictional sample data. Your YouTube account is not
          connected, and no real audience data has been collected.
        </Txt>
        <Button small variant="ghost" onPress={() => setModal("connect")}>
          Connection details
        </Button>
      </Row>
      <Row
        style={{
          justifyContent: "space-between",
          marginBottom: 23,
          flexWrap: "wrap",
        }}
      >
        <Row gap={7}>
          {["Overview", "Content", "Audience"].map((t) => (
            <Chip key={t} active={tab === t} onPress={() => setTab(t)}>
              {t}
            </Chip>
          ))}
        </Row>
        <View style={{ width: 145 }}>
          <Select
            value={period}
            options={[
              { label: "Last 28 days", value: "28" },
              { label: "Last 7 days", value: "7" },
            ]}
            onChange={setPeriod}
          />
        </View>
      </Row>
      {tab === "Overview" ? (
        <>
          <Row gap={16} style={{ flexWrap: "wrap", marginBottom: 22 }}>
            {[
              {
                label: "Views",
                value: Math.round(
                  days.reduce((s, d) => s + d.views, 0),
                ).toLocaleString(),
                icon: Play,
              },
              {
                label: "Watch time",
                value:
                  days.reduce((s, d) => s + d.watchHours, 0).toLocaleString() +
                  " hrs",
                icon: Clock,
              },
              {
                label: "Subscribers gained",
                value:
                  "+" +
                  days.reduce((s, d) => s + d.subscribers, 0).toLocaleString(),
                icon: Users,
              },
            ].map((item) => (
              <Card
                key={item.label}
                style={{ flex: 1, minWidth: 160, padding: 22, gap: 12 }}
              >
                <Row style={{ justifyContent: "space-between" }}>
                  <Txt size={11} muted>
                    {item.label}
                  </Txt>
                  <item.icon size={16} color={theme.purple} />
                </Row>
                <Heading size={28}>{item.value}</Heading>
                <Txt size={9} muted>
                  Sample data · selected period
                </Txt>
              </Card>
            ))}
          </Row>
          <Card style={{ gap: 25, marginBottom: 23 }}>
            <SectionHeading
              title="Keep showing up. See what happens."
              subtitle="Sample views across the selected period"
            />
            <PerformanceChart
              values={days.map((d) => d.views)}
              height={220}
              labels={[
                days[0],
                days[Math.floor(days.length / 2)],
                days.at(-1),
              ].map((d) =>
                new Date(d!.date + "T12:00:00").toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                }),
              )}
            />
          </Card>
          <Row gap={20} style={{ flexWrap: "wrap", alignItems: "stretch" }}>
            <Card style={{ flex: 1, minWidth: 275, gap: 20 }}>
              <Heading size={18}>Where discovery begins</Heading>
              <Row style={{ gap: 28, flexWrap: "wrap" }}>
                <View
                  style={{
                    height: 145,
                    width: 145,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Svg
                    width="145"
                    height="145"
                    style={{ position: "absolute" }}
                  >
                    {a.sources.map((source) => {
                      const rotation = (offset / 100) * 360 - 90;
                      offset += source.value;
                      return (
                        <Circle
                          key={source.name}
                          cx="72.5"
                          cy="72.5"
                          r="56"
                          stroke={source.color}
                          fill="none"
                          strokeWidth="18"
                          strokeDasharray={`${(source.value / 100) * 351.86 - 4} 351.86`}
                          transform={`rotate(${rotation} 72.5 72.5)`}
                        />
                      );
                    })}
                  </Svg>
                  <Txt size={12} weight="600">
                    Discovery
                  </Txt>
                  <Txt size={9} muted>
                    Sample sources
                  </Txt>
                </View>
                <View style={{ flex: 1, gap: 15, minWidth: 140 }}>
                  {a.sources.map((s) => (
                    <Row
                      key={s.name}
                      style={{ justifyContent: "space-between" }}
                    >
                      <Row gap={7}>
                        <View
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: s.color,
                          }}
                        />
                        <Txt size={11} muted>
                          {s.name}
                        </Txt>
                      </Row>
                      <Txt size={11} weight="500">
                        {s.value}%
                      </Txt>
                    </Row>
                  ))}
                </View>
              </Row>
            </Card>
            <Card style={{ flex: 1, minWidth: 260, gap: 18 }}>
              <Row>
                <Lightbulb size={18} color={theme.accent} />
                <Heading size={18}>Look for a useful pattern.</Heading>
              </Row>
              <Txt size={12} muted style={{ lineHeight: 21 }}>
                A single number rarely tells the whole story. Compare videos
                with similar topics, formats, and time windows. Then choose one
                small thing to improve.
              </Txt>
              <View style={{ gap: 9 }}>
                {[
                  "A clearer opening",
                  "A more specific title",
                  "One useful next step",
                ].map((text, i) => (
                  <Row key={text}>
                    <Txt color={theme.purple} weight="600" size={11}>
                      0{i + 1}
                    </Txt>
                    <Txt size={12}>{text}</Txt>
                  </Row>
                ))}
              </View>
              <Button
                variant="secondary"
                icon={ArrowRight}
                onPress={() =>
                  startStudio("A clearer, more helpful video opening", "script")
                }
              >
                Work on the next one
              </Button>
            </Card>
          </Row>
        </>
      ) : tab === "Content" ? (
        <Card style={{ padding: 0 }}>
          <View style={{ padding: 23 }}>
            <Heading size={19}>
              Stories your sample audience spent time with
            </Heading>
            <Txt muted size={11} style={{ marginTop: 5 }}>
              Fictional videos and metrics, used to demonstrate the analytics
              workflow.
            </Txt>
          </View>
          {a.videos.map((video, i) => (
            <Row
              key={video.title}
              style={{
                padding: 20,
                borderTopWidth: 1,
                borderTopColor: theme.border,
                flexWrap: "wrap",
                gap: 18,
              }}
            >
              <Txt size={11} muted>
                {String(i + 1).padStart(2, "0")}
              </Txt>
              <View style={{ width: 83 }}>
                <VideoVisual kind={video.visual} compact />
              </View>
              <View style={{ flex: 1, minWidth: 180, gap: 7 }}>
                <Txt size={13} weight="600">
                  {video.title}
                </Txt>
                <Txt size={10} muted>
                  Sample video · illustrative performance
                </Txt>
              </View>
              <View style={{ width: 70, gap: 4 }}>
                <Txt size={13} weight="600">
                  {(video.views / 1000).toFixed(1)}K
                </Txt>
                <Txt size={9} muted>
                  Views
                </Txt>
              </View>
              <View style={{ width: 60, gap: 4 }}>
                <Txt size={13} weight="600">
                  {video.ctr}%
                </Txt>
                <Txt size={9} muted>
                  CTR
                </Txt>
              </View>
              <View style={{ width: 80, gap: 6 }}>
                <Txt size={12} color={theme.purple}>
                  {video.retention}%
                </Txt>
                <Progress value={video.retention} />
                <Txt size={8} muted>
                  Avg. viewed
                </Txt>
              </View>
              <Button
                small
                variant="ghost"
                icon={ArrowRight}
                label={`Create titles inspired by ${video.title}`}
                onPress={() => startStudio(video.title, "titles")}
              />
            </Row>
          ))}
        </Card>
      ) : (
        <View style={{ gap: 22 }}>
          <Card style={{ gap: 16 }}>
            <Badge>DEMO CHANNEL DNA</Badge>
            <Heading size={24}>
              Curious people. Practical possibilities.
            </Heading>
            <Txt size={12} muted style={{ maxWidth: 690, lineHeight: 22 }}>
              This example profile illustrates how Channel DNA could guide your
              content. It is not an analysis of actual viewers, and no personal
              audience attributes are inferred.
            </Txt>
            <Row gap={12} style={{ flexWrap: "wrap" }}>
              {[
                { title: "Core topic", value: data.profile.niche },
                { title: "Your voice", value: data.profile.voice },
                {
                  title: "Working language",
                  value: data.profile.language === "bn" ? "Bengali" : "English",
                },
              ].map((item) => (
                <View
                  key={item.title}
                  style={{
                    flex: 1,
                    minWidth: 150,
                    padding: 17,
                    backgroundColor: theme.cardAlt,
                    borderRadius: 10,
                    gap: 8,
                  }}
                >
                  <Txt size={10} muted>
                    {item.title}
                  </Txt>
                  <Txt size={14} weight="600">
                    {item.value}
                  </Txt>
                </View>
              ))}
            </Row>
          </Card>
          <Card style={{ gap: 21 }}>
            <Heading size={19}>A sample audience’s favorite formats</Heading>
            {[
              { label: "Hands-on tutorials", value: 64 },
              { label: "Honest tool reviews", value: 23 },
              { label: "Creator stories", value: 13 },
            ].map((item) => (
              <View key={item.label} style={{ gap: 9 }}>
                <Row style={{ justifyContent: "space-between" }}>
                  <Txt size={12}>{item.label}</Txt>
                  <Txt size={11} color={theme.purple}>
                    {item.value}%
                  </Txt>
                </Row>
                <Progress value={item.value} height={7} />
              </View>
            ))}
            <Txt size={10} muted>
              Fictional format mix. Connect an authorized channel and validate
              API availability before using real analytics.
            </Txt>
          </Card>
        </View>
      )}
    </View>
  );
}
