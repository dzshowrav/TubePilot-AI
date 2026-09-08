import React, { useState } from "react";
import { View, Linking, useWindowDimensions } from "react-native";
import Svg, { Path, Line, Circle } from "react-native-svg";
import {
  Eye,
  Users,
  Clapperboard,
  RefreshCw,
  ExternalLink,
  Info,
  Clock,
  UserPlus,
  UserMinus,
  Download,
  Play,
  ShieldCheck,
  Link2,
} from "lucide-react-native";
import type {
  YoutubeMetrics,
  YoutubeReport,
  YoutubeStatus,
  YoutubeVideo,
  YoutubeSnapshot,
} from "@tubepilot/contracts";
import { useApp } from "../state";
import { api } from "../api";
import { downloadText } from "../credentials";
import {
  Badge,
  Button,
  Card,
  Chip,
  Empty,
  Heading,
  PageHeading,
  Row,
  SectionHeading,
  Select,
  Txt,
} from "../components/ui";
import { Youtube } from "../components/visuals";
import { ProjectCard } from "../components/project-card";
const display = (value: number | null | undefined) =>
  value === null || value === undefined
    ? "—"
    : value.toLocaleString("en-US", { maximumFractionDigits: 2 });
const dayLabel = (date: string) =>
  date
    ? new Date(date + "T12:00:00Z").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    : "Unavailable";
function SyncButton() {
  const { data, refresh, notify } = useApp();
  const state = data?.youtube;
  const [busy, setBusy] = useState(false);
  const running = ["queued", "running"].includes(state?.sync?.status ?? "");
  return (
    <Button
      icon={RefreshCw}
      variant="secondary"
      loading={busy || running}
      disabled={!state?.configured || state.state !== "connected"}
      onPress={() => {
        setBusy(true);
        void api("/youtube/sync", "POST", {})
          .then(() => refresh())
          .then(() => notify("Read-only channel refresh started."))
          .catch((error) => notify(error.message))
          .finally(() => setBusy(false));
      }}
    >
      {running ? "Reading channel…" : "Refresh channel"}
    </Button>
  );
}
export function YoutubeNotice() {
  const { data, theme, setModal } = useApp();
  const state = data!.youtube;
  return (
    <Card
      style={{
        backgroundColor: theme.purpleBg,
        borderColor: theme.purple + "33",
        padding: 16,
        gap: 11,
      }}
    >
      <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <Row>
          <Youtube size={18} color={theme.purple} />
          <Txt size={12} weight="600" color={theme.purple}>
            {state.state === "needs_reconnect"
              ? "Authorization needs attention"
              : "Your authorized YouTube data"}
          </Txt>
          <Badge color={theme.positive}>READ ONLY</Badge>
        </Row>
        <Button small variant="ghost" onPress={() => setModal("connect")}>
          Connection & permissions
        </Button>
      </Row>
      <Txt size={11} muted style={{ lineHeight: 19 }}>
        {state.state === "needs_reconnect"
          ? state.message
          : state.message
            ? "Refresh issue: " +
              state.message +
              " Cached values below keep their original timestamps."
            : state.lastSyncedAt
              ? "Last successful read: " +
                new Date(state.lastSyncedAt).toLocaleString() +
                ". YouTube reports may lag; missing values stay unavailable."
              : "Your channel is linked. Waiting for the first read-only refresh."}
      </Txt>
      {!state.configured && (
        <Txt size={11} color={theme.danger}>
          Server configuration is currently unavailable. Refreshing is disabled.
        </Txt>
      )}
    </Card>
  );
}
function Metric({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string;
  value: number | null | undefined;
  note: string;
  icon: React.ComponentType<any>;
}) {
  const { theme } = useApp();
  return (
    <Card style={{ flex: 1, minWidth: 145, padding: 20, gap: 12 }}>
      <Row style={{ justifyContent: "space-between" }}>
        <Txt size={11} muted>
          {label}
        </Txt>
        <Icon size={16} color={theme.purple} />
      </Row>
      <Heading size={25}>{display(value)}</Heading>
      <Txt size={9} muted>
        {value === null || value === undefined
          ? "Not reported / unavailable"
          : note}
      </Txt>
    </Card>
  );
}
function ReportUnavailable({ report }: { report: YoutubeReport | null }) {
  const { setModal } = useApp();
  return (
    <Card>
      <Empty
        icon={ShieldCheck}
        title={
          report?.state === "missing_scope"
            ? "A little more permission is needed."
            : "No historical report is available yet."
        }
        description={
          report?.message ??
          "The first sync has not returned a historical report. Refresh the channel or review permissions."
        }
        action="Review connection"
        onAction={() => setModal("connect")}
      />
    </Card>
  );
}
function RecentVideos({
  videos,
}: {
  videos: YoutubeSnapshot["videos"] | undefined;
}) {
  const { theme } = useApp();
  if (!videos || videos.state === "unavailable")
    return (
      <Card>
        <Txt size={12} muted>
          {videos?.message ??
            "Recent uploads will appear after a successful refresh."}
        </Txt>
      </Card>
    );
  if (!videos.items.length)
    return (
      <Card>
        <Empty
          icon={Clapperboard}
          title="No recent uploads were returned."
          description="This is the response from the authorized uploads playlist, not an estimate of channel activity."
        />
      </Card>
    );
  return (
    <View style={{ gap: 12 }}>
      {videos.items.map((video) => (
        <Card key={video.id} style={{ padding: 18 }}>
          <Row style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
            <View
              style={{
                width: 62,
                height: 48,
                borderRadius: 10,
                backgroundColor: theme.purpleBg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Play size={21} color={theme.purple} />
            </View>
            <View style={{ flex: 1, minWidth: 180, gap: 7 }}>
              <Txt size={13} weight="600">
                {video.title}
              </Txt>
              <Txt size={10} muted>
                {video.publishedAt
                  ? new Date(video.publishedAt).toLocaleDateString()
                  : "Publication date unavailable"}{" "}
                · Authorized video metadata
              </Txt>
            </View>
            <View style={{ gap: 5, width: 90 }}>
              <Txt size={14} weight="600">
                {display(video.views)}
              </Txt>
              <Txt size={9} muted>
                Lifetime views
              </Txt>
            </View>
            <View style={{ gap: 5, width: 72 }}>
              <Txt size={12}>{display(video.likes)}</Txt>
              <Txt size={9} muted>
                Likes
              </Txt>
            </View>
            <Button
              small
              icon={ExternalLink}
              variant="ghost"
              label={`Open ${video.title} on YouTube`}
              onPress={() =>
                void Linking.openURL(
                  `https://www.youtube.com/watch?v=${video.id}`,
                )
              }
            />
          </Row>
        </Card>
      ))}
    </View>
  );
}
function DailyChart({
  report,
  days,
  metric,
}: {
  report: YoutubeReport;
  days: number;
  metric: keyof YoutubeMetrics;
}) {
  const { theme } = useApp();
  const period = report.periods.find((p) => p.days === days);
  const rows = report.series.filter(
    (row) => !period || row.date >= period.startDate,
  );
  const valid = rows.filter((row) => row[metric] !== null);
  if (!period || !valid.length)
    return <Txt muted>No returned values for this metric and period.</Txt>;
  const max = Math.max(1, ...valid.map((row) => row[metric]!)),
    start = Date.parse(period.startDate),
    end = Date.parse(period.endDate),
    span = Math.max(86400000, end - start),
    width = 800,
    height = 170;
  let previous: number | null = null,
    path = "";
  const points = rows.flatMap((row) => {
    const value = row[metric],
      time = Date.parse(row.date);
    if (value === null) {
      previous = null;
      return [];
    }
    const x = ((time - start) / span) * width,
      y = height - 10 - (value / max) * (height - 25);
    path += `${previous === null || time - previous > 86400000 ? "M" : "L"}${x},${y} `;
    previous = time;
    return [{ x, y, date: row.date }];
  });
  return (
    <View style={{ gap: 13 }}>
      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        accessibilityLabel={`Reported ${metric}; gaps indicate absent API rows, not zero activity`}
      >
        {[0, 0.5, 1].map((n) => (
          <Line
            key={n}
            x1="0"
            x2={width}
            y1={15 + n * (height - 25)}
            y2={15 + n * (height - 25)}
            stroke={theme.border}
            strokeDasharray="4 6"
          />
        ))}
        <Path
          d={path}
          fill="none"
          stroke={theme.purple}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {points.map((p) => (
          <Circle
            key={p.date}
            cx={p.x}
            cy={p.y}
            r={points.length === 1 ? 4 : 2}
            fill={theme.purple}
          />
        ))}
      </Svg>
      <Row style={{ justifyContent: "space-between" }}>
        <Txt size={10} muted>
          {dayLabel(period.startDate)}
        </Txt>
        <Txt size={10} muted>
          Returned API rows · Pacific reporting days
        </Txt>
        <Txt size={10} muted>
          {dayLabel(period.endDate)}
        </Txt>
      </Row>
    </View>
  );
}
export function YoutubeOverview() {
  const { data, theme, setModal, navigate } = useApp();
  const state = data!.youtube,
    channel = state.channel,
    snapshot = state.snapshot;
  return (
    <View style={{ gap: 24 }}>
      <PageHeading
        eyebrow="YOUR CHANNEL, NOT A SAMPLE"
        title={channel?.title ?? "Let’s reconnect your channel."}
        description="A read-only view of what Google actually returned. No projections or invented comparisons."
        action={<SyncButton />}
      />
      <YoutubeNotice />
      <Row gap={14} style={{ flexWrap: "wrap" }}>
        <Metric
          label="Channel views"
          value={channel?.views}
          note="Lifetime · as reported by YouTube"
          icon={Eye}
        />
        <Metric
          label="Subscribers"
          value={channel?.subscribers}
          note="May be rounded by YouTube"
          icon={Users}
        />
        <Metric
          label="Uploaded videos"
          value={channel?.videos}
          note="As reported by YouTube"
          icon={Clapperboard}
        />
      </Row>
      {channel?.subscribersHidden && (
        <Txt muted size={11}>
          This channel’s subscriber count is hidden. TubePilot does not estimate
          it.
        </Txt>
      )}
      <View>
        <SectionHeading
          title="A clearer view, with a clear source"
          subtitle="Historical channel activity is separate from lifetime counters."
          action="Open analytics"
          onAction={() => navigate("analytics")}
        />
        {snapshot?.analytics.state === "ready" ? (
          <Card style={{ gap: 20 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <Heading size={18}>Reported views</Heading>
              <Badge>YOUTUBE ANALYTICS</Badge>
            </Row>
            <DailyChart report={snapshot.analytics} days={28} metric="views" />
            <Txt size={10} muted>
              Available through {snapshot.analytics.availableThrough}. No
              YouTube data from this connector is sent to AI.
            </Txt>
          </Card>
        ) : (
          <ReportUnavailable report={snapshot?.analytics ?? null} />
        )}
      </View>
      <View>
        <SectionHeading
          title="Recent uploads"
          subtitle="Up to 12 videos returned by your authorized uploads playlist."
        />
        <RecentVideos videos={snapshot?.videos} />
      </View>
      <View>
        <SectionHeading
          title="Your workspace projects"
          subtitle="Your editable drafts stay separate from YouTube observations."
          action="All projects"
          onAction={() => navigate("projects")}
        />
        <Row gap={16} style={{ flexWrap: "wrap", alignItems: "stretch" }}>
          {data!.projects.slice(0, 3).map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </Row>
      </View>
    </View>
  );
}
export function YoutubeAnalytics() {
  const { data, theme, setModal, notify } = useApp();
  const [tab, setTab] = useState("Overview"),
    [days, setDays] = useState("28"),
    [metric, setMetric] = useState<keyof YoutubeMetrics>("views");
  const state = data!.youtube,
    snapshot = state.snapshot,
    report = snapshot?.analytics ?? null,
    period = report?.periods.find((p) => p.days === Number(days));
  const exportCsv = () => {
    if (!report || report.state !== "ready") return;
    const rows = report.series.filter(
      (row) => !period || row.date >= period.startDate,
    );
    downloadText(
      "youtube-reported-analytics.csv",
      "reporting_day,views,estimated_minutes_watched,subscribers_gained,subscribers_lost,source\n" +
        rows
          .map((row) =>
            [
              row.date,
              row.views ?? "",
              row.estimatedMinutesWatched ?? "",
              row.subscribersGained ?? "",
              row.subscribersLost ?? "",
              "youtube_analytics",
            ].join(","),
          )
          .join("\n"),
      "text/csv",
    );
    notify("YouTube report exported. Blank values mean unavailable, not zero.");
  };
  return (
    <View style={{ gap: 23 }}>
      <PageHeading
        eyebrow="AUTHORIZED OBSERVATIONS"
        title="Your channel, with the context intact."
        description="Raw API metrics, clear reporting windows, and no synthetic scores."
        action={<SyncButton />}
      />
      <YoutubeNotice />
      <Row style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <Row gap={7} style={{ flexWrap: "wrap" }}>
          {["Overview", "Recent uploads", "Data & permissions"].map((item) => (
            <Chip active={item === tab} key={item} onPress={() => setTab(item)}>
              {item}
            </Chip>
          ))}
        </Row>
        {tab === "Overview" && (
          <View style={{ width: 160 }}>
            <Select
              label="Reporting period"
              value={days}
              options={[
                { label: "Last 28 days", value: "28" },
                { label: "Last 7 days", value: "7" },
              ]}
              onChange={setDays}
            />
          </View>
        )}
      </Row>
      {tab === "Overview" ? (
        report?.state === "ready" ? (
          <>
            <Row gap={13} style={{ flexWrap: "wrap" }}>
              <Metric
                label="Views"
                value={period?.totals.views}
                note="Returned period aggregate"
                icon={Eye}
              />
              <Metric
                label="Watch time (minutes)"
                value={period?.totals.estimatedMinutesWatched}
                note="YouTube estimated watch minutes"
                icon={Clock}
              />
              <Metric
                label="Subscribers gained"
                value={period?.totals.subscribersGained}
                note="Returned period aggregate"
                icon={UserPlus}
              />
              <Metric
                label="Subscribers lost"
                value={period?.totals.subscribersLost}
                note="Returned period aggregate"
                icon={UserMinus}
              />
            </Row>
            <Card style={{ gap: 22 }}>
              <Row
                style={{ justifyContent: "space-between", flexWrap: "wrap" }}
              >
                <View style={{ flex: 1, gap: 5 }}>
                  <Heading size={20}>A day-by-day view.</Heading>
                  <Txt size={11} muted>
                    Requested through {report.requestedEndDate}; Google returned
                    data through {report.availableThrough}.
                  </Txt>
                </View>
                <View style={{ width: 185 }}>
                  <Select
                    label="Chart metric"
                    value={metric}
                    options={[
                      { label: "Views", value: "views" },
                      {
                        label: "Watch minutes",
                        value: "estimatedMinutesWatched",
                      },
                      {
                        label: "Subscribers gained",
                        value: "subscribersGained",
                      },
                      { label: "Subscribers lost", value: "subscribersLost" },
                    ]}
                    onChange={(v) => setMetric(v as keyof YoutubeMetrics)}
                  />
                </View>
              </Row>
              <DailyChart report={report} days={Number(days)} metric={metric} />
              <Row
                style={{ justifyContent: "space-between", flexWrap: "wrap" }}
              >
                <Txt size={10} muted>
                  Gaps stay gaps. Missing rows are not plotted as zero.
                </Txt>
                <Button
                  small
                  variant="secondary"
                  icon={Download}
                  onPress={exportCsv}
                >
                  Export reported data
                </Button>
              </Row>
            </Card>
            <Card style={{ gap: 14 }}>
              <Heading size={18}>The returned rows</Heading>
              {report.series
                .filter((row) => !period || row.date >= period.startDate)
                .map((row) => (
                  <Row
                    key={row.date}
                    style={{
                      justifyContent: "space-between",
                      paddingVertical: 8,
                      borderBottomWidth: 1,
                      borderBottomColor: theme.border,
                    }}
                  >
                    <Txt size={11} muted>
                      {row.date}
                    </Txt>
                    <Txt size={12} weight="500">
                      {display(row[metric])}
                    </Txt>
                  </Row>
                ))}
              <Txt size={10} muted>
                Timezone: {report.reportingTimezone}. These are daily buckets,
                not real-time or exact-second observations.
              </Txt>
            </Card>
          </>
        ) : (
          <ReportUnavailable report={report} />
        )
      ) : tab === "Recent uploads" ? (
        <RecentVideos videos={snapshot?.videos} />
      ) : (
        <View style={{ gap: 19 }}>
          <Card style={{ gap: 19 }}>
            <Badge>MINIMUM NECESSARY ACCESS</Badge>
            <Heading size={22}>A useful connection. Clear limits.</Heading>
            {[
              {
                name: "Channel details and statistics",
                state: "Read-only permission",
                detail:
                  "channels.list with mine=true. Hidden/missing counts remain unavailable.",
              },
              {
                name: "Recent upload metadata",
                state: "Read-only permission",
                detail:
                  "playlistItems.list and videos.list. Up to 12 uploads, not a full channel inventory.",
              },
              {
                name: "Views, watch minutes, subscribers gained/lost",
                state: state.analyticsGranted
                  ? "Analytics permission granted"
                  : "Optional permission not granted",
                detail:
                  "Owner-authorized YouTube Analytics reports. Availability and freshness are reported, not assumed.",
              },
              {
                name: "CTR, retention, traffic sources, predictions and scores",
                state: "Not requested in this milestone",
                detail:
                  "No unsupported values or demo metrics are inserted into your connected channel.",
              },
            ].map((item) => (
              <View
                key={item.name}
                style={{
                  gap: 6,
                  paddingBottom: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.border,
                }}
              >
                <Txt weight="600" size={13}>
                  {item.name}
                </Txt>
                <Txt color={theme.purple} size={11}>
                  {item.state}
                </Txt>
                <Txt muted size={11}>
                  {item.detail}
                </Txt>
              </View>
            ))}
            <Button
              variant="secondary"
              icon={Link2}
              onPress={() => setModal("connect")}
            >
              Manage Google permissions
            </Button>
          </Card>
          <Card style={{ gap: 13 }}>
            <Row>
              <ShieldCheck size={19} color={theme.positive} />
              <Heading size={19}>Your data stays in its own lane.</Heading>
            </Row>
            <Txt size={12} muted>
              Provider tokens are encrypted server-side. No connected-channel
              data is fed to the AI gateway. Derived metrics, prediction scores,
              and extended storage stay disabled pending the applicable reviews.
            </Txt>
            <Txt size={11} muted>
              Cached data expiry:{" "}
              {state.dataExpiresAt
                ? new Date(state.dataExpiresAt).toLocaleString()
                : "No cached data"}
              . Disconnecting deletes the local YouTube snapshot immediately;
              permission revocation may take longer if Google is unavailable.
            </Txt>
          </Card>
        </View>
      )}
    </View>
  );
}
