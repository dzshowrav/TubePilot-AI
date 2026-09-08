import { YoutubeOverview } from "./Youtube";
import React, { useState } from "react";
import { View, Image, useWindowDimensions, Pressable } from "react-native";
import {
  Eye,
  Clock,
  Users,
  MousePointer2,
  ArrowUpRight,
  Sparkles,
  ArrowRight,
  Plus,
  Lightbulb,
  CalendarDays,
  TrendingUp,
} from "lucide-react-native";
import { useApp } from "../state";
import {
  Badge,
  Button,
  Card,
  Heading,
  Row,
  SectionHeading,
  Select,
  Txt,
} from "../components/ui";
import {
  PerformanceChart,
  Sparkline,
  VideoVisual,
  Score,
} from "../components/visuals";
import { ProjectCard } from "../components/project-card";
import hero from "../../assets/studio-hero.png";
const compact = (v: number) =>
  v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toLocaleString();
export function Overview() {
  const { data } = useApp();
  return data?.youtube?.connectionId ? <YoutubeOverview /> : <DemoOverview />;
}
function DemoOverview() {
  const { data, theme, startStudio, navigate, setModal } = useApp();
  const { width } = useWindowDimensions();
  const [period, setPeriod] = useState("28"),
    [metric, setMetric] = useState("views");
  if (!data) return null;
  const daily = data.analytics.series.slice(-Number(period));
  const stats = [
    {
      label: "Total views",
      value:
        period === "28"
          ? "248.6K"
          : compact(daily.reduce((s, d) => s + d.views, 0)),
      change: "24.8%",
      icon: Eye,
      color: theme.purple,
      key: "views",
    },
    {
      label: "Watch time (hours)",
      value:
        period === "28"
          ? "18.4K"
          : compact(daily.reduce((s, d) => s + d.watchHours, 0)),
      change: "18.6%",
      icon: Clock,
      color: theme.accent,
      key: "watchHours",
    },
    {
      label: "Subscribers gained",
      value:
        period === "28"
          ? "+1,248"
          : "+" + daily.reduce((s, d) => s + d.subscribers, 0),
      change: "12.3%",
      icon: Users,
      color: "#eeb88b",
      key: "subscribers",
    },
    {
      label: "Impressions CTR",
      value: "6.8%",
      change: "1.2%",
      icon: MousePointer2,
      color: "#98beca",
      key: "ctr",
    },
  ];
  const labels = [
    daily[0],
    daily[Math.floor(daily.length / 3)],
    daily[Math.floor((daily.length * 2) / 3)],
    daily.at(-1),
  ]
    .filter(Boolean)
    .map((d) =>
      new Date(d!.date + "T12:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
    );
  return (
    <View style={{ gap: 24 }}>
      <Row
        style={{
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <View style={{ gap: 7 }}>
          <Row gap={8}>
            <Heading size={28}>
              Good to see you, {data.profile.name.split(" ")[0]}{" "}
              <Txt size={25}>✺</Txt>
            </Heading>
          </Row>
          <Txt size={12} muted>
            A little clarity. A fresh perspective. Your next great video.
          </Txt>
        </View>
        <View style={{ width: 152 }}>
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
      <View
        style={{
          backgroundColor: theme.hero,
          borderColor: theme.purple + "21",
          borderWidth: 1,
          borderRadius: 16,
          overflow: "hidden",
          minHeight: 205,
          justifyContent: "center",
        }}
      >
        <Image
          source={typeof hero === "number" ? hero : { uri: hero }}
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: width > 1100 ? 370 : width > 700 ? 300 : 230,
            height: "100%",
            opacity: width < 650 ? 0.3 : 1,
          }}
          resizeMode="cover"
        />
        <View
          style={{
            padding: width < 700 ? 23 : 24,
            gap: 12,
            maxWidth: width < 700 ? 420 : 510,
          }}
        >
          <Row gap={7}>
            <Sparkles size={13} color={theme.purple} />
            <Txt
              size={9}
              color={theme.purple}
              weight="600"
              style={{ letterSpacing: 1.5 }}
            >
              LESS GUESSWORK. MORE GREAT IDEAS.
            </Txt>
          </Row>
          <Heading size={width < 700 ? 25 : 29} style={{ lineHeight: 37 }}>
            Your next great video{width > 600 ? "\n" : " "}starts with a good
            idea.
          </Heading>
          <Txt size={11} muted style={{ maxWidth: 390, lineHeight: 19 }}>
            An idea, a story, a video only you could make.
          </Txt>
          <Row style={{ marginTop: 4, flexWrap: "wrap" }}>
            <Button icon={Sparkles} onPress={() => startStudio()}>
              Find my next idea
            </Button>
            <Button
              variant="ghost"
              icon={ArrowRight}
              onPress={() => navigate("trends")}
            >
              Explore trends
            </Button>
          </Row>
        </View>
      </View>
      <Row gap={14} style={{ flexWrap: "wrap" }}>
        {stats.map((stat, i) => (
          <Card
            key={stat.label}
            style={{
              flex: 1,
              minWidth: width < 700 ? 135 : 175,
              padding: 18,
              gap: 13,
            }}
          >
            <Row style={{ justifyContent: "space-between" }}>
              <Txt size={10} muted>
                {stat.label}
              </Txt>
              <stat.icon size={14} color={theme.faint} strokeWidth={1.7} />
            </Row>
            <Row
              style={{
                justifyContent: "space-between",
                alignItems: "flex-end",
                gap: 2,
              }}
            >
              <Heading size={25}>{stat.value}</Heading>
              <Sparkline
                values={daily.map((d, j) =>
                  stat.key === "subscribers"
                    ? d.subscribers
                    : stat.key === "watchHours"
                      ? d.watchHours
                      : d.views + Math.sin(j + i) * 1000,
                )}
                color={stat.color}
                width={width < 700 ? 40 : 62}
                height={28}
              />
            </Row>
            <Row gap={5}>
              <ArrowUpRight size={11} color={theme.positive} />
              <Txt size={9} color={theme.positive} weight="500">
                {stat.change}
              </Txt>
              <Txt size={8} muted>
                sample comparison
              </Txt>
            </Row>
          </Card>
        ))}
      </Row>
      <Row gap={18} style={{ alignItems: "stretch", flexWrap: "wrap" }}>
        <Card
          style={{
            flex: 2,
            minWidth: width < 700 ? 280 : 420,
            padding: 22,
            gap: 20,
          }}
        >
          <Row style={{ justifyContent: "space-between" }}>
            <View>
              <Heading size={16}>A little momentum goes a long way</Heading>
              <Txt size={10} muted style={{ marginTop: 4 }}>
                Your channel performance · sample data
              </Txt>
            </View>
            <View style={{ width: 100 }}>
              <Select
                value={metric}
                options={[
                  { label: "Views", value: "views" },
                  { label: "Subscribers", value: "subscribers" },
                  { label: "Watch time", value: "watchHours" },
                ]}
                onChange={setMetric}
              />
            </View>
          </Row>
          <PerformanceChart
            values={daily.map(
              (d) => d[metric as "views" | "subscribers" | "watchHours"],
            )}
            labels={labels}
            height={150}
          />
          <Row gap={6}>
            <View
              style={{
                height: 5,
                width: 5,
                borderRadius: 3,
                backgroundColor: theme.purple,
              }}
            />
            <Txt size={9} muted>
              Current period
            </Txt>
            <View style={{ flex: 1 }} />
            <Txt size={8} muted>
              Illustrative analytics, not a connected channel
            </Txt>
          </Row>
        </Card>
        <Card style={{ flex: 1, minWidth: 250, padding: 22, gap: 18 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <Row gap={7}>
              <Lightbulb size={15} color={theme.accent} />
              <Heading size={15}>Your next move</Heading>
            </Row>
            <Badge>DEMO INSIGHT</Badge>
          </Row>
          <View style={{ gap: 10 }}>
            <Heading size={21} style={{ lineHeight: 29, letterSpacing: -0.5 }}>
              Make something useful.{"\n"}Make it unmistakably you.
            </Heading>
            <Txt size={11} muted style={{ lineHeight: 20 }}>
              For your {data.profile.niche.toLowerCase()} niche, try a hands-on
              walkthrough with an honest, personal take. One clear problem. One
              helpful outcome.
            </Txt>
          </View>
          <View
            style={{
              padding: 12,
              borderRadius: 9,
              backgroundColor: theme.cardAlt,
            }}
          >
            <Txt size={10} color={theme.purple}>
              ✦ A practical angle beats a generic idea.
            </Txt>
          </View>
          <Button
            variant="secondary"
            icon={ArrowRight}
            onPress={() =>
              startStudio(
                "A practical, personal walkthrough for my " +
                  data.profile.niche +
                  " audience",
              )
            }
          >
            Build on this idea
          </Button>
        </Card>
      </Row>
      <View>
        <SectionHeading
          title="Your ideas, taking shape"
          subtitle="Pick up where you left off. Make the next little move."
          action="All projects"
          onAction={() => navigate("projects")}
        />
        <Row gap={16} style={{ alignItems: "stretch", flexWrap: "wrap" }}>
          {data.projects.slice(0, 3).map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
          {data.projects.length === 0 && (
            <Card style={{ flex: 1, alignItems: "center", gap: 12 }}>
              <Txt muted>Your first project starts with a small idea.</Txt>
              <Button icon={Plus} onPress={() => startStudio()}>
                Create a video idea
              </Button>
            </Card>
          )}
        </Row>
      </View>
      <View>
        <SectionHeading
          title="Worth a closer look"
          subtitle="A few fresh directions for your creative radar. Sample opportunities only."
          action="Open Trend Radar"
          onAction={() => navigate("trends")}
        />
        <Row gap={16} style={{ flexWrap: "wrap" }}>
          {data.trends.slice(0, 2).map((trend) => (
            <Pressable
              accessibilityRole="button"
              key={trend.id}
              onPress={() => navigate("trends")}
              style={{
                flex: 1,
                minWidth: 275,
                padding: 15,
                backgroundColor: theme.card,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.border,
                flexDirection: "row",
                gap: 14,
                alignItems: "center",
              }}
            >
              <View style={{ width: 76 }}>
                <VideoVisual kind={trend.visual} compact />
              </View>
              <View style={{ flex: 1, gap: 7 }}>
                <Txt size={12} weight="600" numberOfLines={2}>
                  {trend.title}
                </Txt>
                <Row gap={6}>
                  <Badge dot color={theme.positive}>
                    {trend.state}
                  </Badge>
                  <Txt size={9} muted>
                    Sample fit
                  </Txt>
                </Row>
              </View>
              <Score value={trend.score} />
            </Pressable>
          ))}
        </Row>
      </View>
      {!data.profile.onboardingComplete && (
        <Row
          style={{
            padding: 16,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: theme.border,
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <Row>
            <Sparkles size={16} color={theme.purple} />
            <Txt size={11} muted>
              A workspace that sounds like you. Set your niche, goals, and brand
              voice.
            </Txt>
          </Row>
          <Button small variant="ghost" onPress={() => setModal("onboarding")}>
            Make it yours →
          </Button>
        </Row>
      )}
    </View>
  );
}
