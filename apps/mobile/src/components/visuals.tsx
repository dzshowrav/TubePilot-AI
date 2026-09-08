import React, { useId } from "react";
import { View } from "react-native";
import Svg, {
  Circle,
  Rect,
  Path,
  Line,
  Defs,
  LinearGradient,
  Stop,
  Polyline,
} from "react-native-svg";
import { Play, Sparkles } from "lucide-react-native";
import type { Project, Trend } from "@tubepilot/contracts";
import { useApp } from "../state";
import { Txt, Row } from "./ui";

const visuals = {
  tools: {
    bg: "#d4cff2",
    ink: "#3b3058",
    accent: "#9880d7",
    title: "TOOLS THAT\nJUST WORK.",
    label: "THE AI EDIT",
  },
  workflow: {
    bg: "#cce0d4",
    ink: "#274738",
    accent: "#789b88",
    title: "LESS CHAOS.\nMORE CREATING.",
    label: "A BETTER WORKFLOW",
  },
  creator: {
    bg: "#e5d6b5",
    ink: "#51452d",
    accent: "#b5a27c",
    title: "SMALL TEAM.\nBIG IDEAS.",
    label: "THE CREATOR ECONOMY",
  },
  studio: {
    bg: "#d9c9bd",
    ink: "#534034",
    accent: "#a98770",
    title: "YOUR SPACE.\nYOUR PACE.",
    label: "CREATIVE SPACES",
  },
  coding: {
    bg: "#d5dce9",
    ink: "#2f3b55",
    accent: "#7f96b8",
    title: "LET’S BUILD\nSOMETHING.",
    label: "BUILT WITH CURIOSITY",
  },
  design: {
    bg: "#e4cde5",
    ink: "#543953",
    accent: "#b587b6",
    title: "MAKE IT\nYOUR OWN.",
    label: "THE DESIGN EDIT",
  },
};
export function VideoVisual({
  kind = "tools",
  compact = false,
}: {
  kind?: Project["visual"];
  compact?: boolean;
}) {
  const v = visuals[kind];
  return (
    <View
      accessibilityLabel={`Illustrated sample ${kind} video cover`}
      style={{
        backgroundColor: v.bg,
        aspectRatio: compact ? 1.4 : 1.95,
        borderRadius: 10,
        overflow: "hidden",
        width: "100%",
      }}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 380 190"
        style={{ position: "absolute", top: 0, right: 0 }}
      >
        <Circle cx="324" cy="150" r="105" fill={v.accent} opacity={0.2} />
        <Circle
          cx="295"
          cy="67"
          r="60"
          fill="none"
          stroke={v.ink}
          strokeWidth="1"
          opacity=".17"
        />
        {kind === "tools" || kind === "coding" ? (
          <>
            <Rect
              x="225"
              y="39"
              width="115"
              height="116"
              rx="19"
              fill={v.ink}
              transform="rotate(10 282 96)"
            />
            <Rect
              x="240"
              y="50"
              width="86"
              height="76"
              rx="12"
              fill={v.accent}
            />
            <Path d="m273 67 27 20-27 20V67Z" fill={v.bg} />
            <Rect
              x="247"
              y="137"
              width="61"
              height="4"
              rx="2"
              fill={v.bg}
              opacity=".6"
            />
            <Circle cx="334" cy="32" r="19" fill={v.bg} />
            <Path d="m334 19 4 9 9 4-9 4-4 9-4-9-9-4 9-4z" fill={v.ink} />
          </>
        ) : kind === "workflow" ? (
          <>
            <Rect
              x="236"
              y="30"
              width="94"
              height="132"
              rx="12"
              fill={v.ink}
              transform="rotate(-10 280 96)"
            />
            <Rect x="238" y="35" width="88" height="118" rx="10" fill={v.bg} />
            {[61, 84, 107, 130].map((y, i) => (
              <React.Fragment key={y}>
                <Rect
                  x="250"
                  y={y}
                  width="10"
                  height="10"
                  rx="3"
                  fill={i === 3 ? v.accent : v.ink}
                />
                <Line
                  x1="268"
                  x2={i % 2 ? "307" : "296"}
                  y1={y + 5}
                  y2={y + 5}
                  stroke={v.ink}
                  strokeWidth="3"
                  opacity=".4"
                />
              </React.Fragment>
            ))}
            <Circle cx="333" cy="146" r="24" fill={v.accent} />
            <Path
              d="m322 146 7 7 15-16"
              fill="none"
              stroke={v.bg}
              strokeWidth="4"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            <Rect x="236" y="85" width="98" height="78" rx="40" fill={v.ink} />
            <Circle cx="285" cy="56" r="30" fill={v.accent} />
            <Circle cx="334" cy="48" r="14" fill={v.ink} opacity=".15" />
            <Rect
              x="227"
              y="151"
              width="120"
              height="8"
              rx="4"
              fill={v.accent}
            />
            <Circle cx="225" cy="39" r="8" fill={v.ink} />
          </>
        )}
      </Svg>
      {!compact && (
        <View
          style={{
            position: "absolute",
            top: 19,
            left: 18,
            right: 130,
            gap: 9,
          }}
        >
          <Txt
            color={v.ink}
            size={7}
            weight="700"
            style={{ letterSpacing: 1.3 }}
          >
            {v.label}
          </Txt>
          <Txt
            color={v.ink}
            size={19}
            weight="700"
            style={{ lineHeight: 23, letterSpacing: -0.7 }}
          >
            {v.title}
          </Txt>
        </View>
      )}
      <View
        style={{
          position: "absolute",
          bottom: 9,
          right: 9,
          paddingVertical: 3,
          paddingHorizontal: 6,
          borderRadius: 4,
          backgroundColor: "#14151bba",
        }}
      >
        <Txt color="#ffffff" size={8} weight="600">
          {compact ? "▶" : "DRAFT"}
        </Txt>
      </View>
    </View>
  );
}

export function Sparkline({
  values,
  color,
  width = 76,
  height = 34,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  const min = Math.min(...values),
    span = Math.max(...values) - min || 1;
  const points = values
    .map(
      (n, i) =>
        `${(i / (values.length - 1)) * width},${height - 5 - ((n - min) / span) * (height - 10)}`,
    )
    .join(" ");
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
export function PerformanceChart({
  values,
  labels,
  height = 165,
}: {
  values: number[];
  labels?: string[];
  height?: number;
}) {
  const { theme } = useApp(),
    id = useId().replace(/:/g, "");
  const width = 780,
    max = Math.max(...values) * 1.15 || 1;
  const points = values.map((n, i) => [
    (i / (values.length - 1)) * width,
    height - 10 - (n / max) * (height - 20),
  ]);
  const line = points
      .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`)
      .join(" "),
    area = `${line} L${width},${height} L0,${height}Z`;
  return (
    <View style={{ gap: 10 }}>
      <Row gap={12} style={{ alignItems: "stretch" }}>
        <View
          style={{
            justifyContent: "space-between",
            width: 30,
            paddingBottom: 4,
          }}
        >
          {[1, 0.66, 0.33, 0].map((n) => (
            <Txt key={n} size={8} muted>
              {max >= 1000
                ? `${Math.round((max * n) / 1000)}k`
                : Math.round(max * n)}
            </Txt>
          ))}
        </View>
        <View style={{ flex: 1, height }}>
          <Svg
            accessibilityLabel="Sample channel performance over the selected period"
            width="100%"
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
          >
            <Defs>
              <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={theme.purple} stopOpacity=".27" />
                <Stop offset="1" stopColor={theme.purple} stopOpacity=".015" />
              </LinearGradient>
            </Defs>
            {[0, 0.33, 0.66, 1].map((n) => (
              <Line
                key={n}
                x1="0"
                x2={width}
                y1={n * (height - 10) + 5}
                y2={n * (height - 10) + 5}
                stroke={theme.border}
                strokeDasharray="3 6"
                strokeWidth="1"
              />
            ))}
            <Path d={area} fill={`url(#${id})`} />
            <Path
              d={line}
              fill="none"
              stroke={theme.purple}
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Circle
              cx={points.at(-1)?.[0]}
              cy={points.at(-1)?.[1]}
              r="4"
              fill={theme.purple}
              stroke={theme.card}
              strokeWidth="2"
            />
          </Svg>
        </View>
      </Row>
      {labels && (
        <Row style={{ justifyContent: "space-between", paddingLeft: 43 }}>
          {labels.map((label, i) => (
            <Txt key={`${label}${i}`} size={8} muted>
              {label}
            </Txt>
          ))}
        </Row>
      )}
    </View>
  );
}
export function Score({ value }: { value: number }) {
  const { theme } = useApp();
  return (
    <View
      style={{
        width: 40,
        height: 40,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Svg width="40" height="40" style={{ position: "absolute" }}>
        <Circle
          cx="20"
          cy="20"
          r="17"
          fill="none"
          stroke={theme.border}
          strokeWidth="2.5"
        />
        <Circle
          cx="20"
          cy="20"
          r="17"
          fill="none"
          stroke={theme.accent}
          strokeWidth="2.5"
          strokeDasharray={`${(value / 100) * 106.8} 106.8`}
          transform="rotate(-90 20 20)"
          strokeLinecap="round"
        />
      </Svg>
      <Txt size={12} weight="600" color={theme.accent}>
        {value}
      </Txt>
    </View>
  );
}
export function Logo({ small = false }: { small?: boolean }) {
  const { theme } = useApp();
  return (
    <Row gap={10}>
      <View
        style={{
          width: small ? 30 : 33,
          height: small ? 30 : 33,
          borderRadius: 10,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.accent,
        }}
      >
        <Svg width="23" height="23" viewBox="0 0 24 24">
          <Path d="m8 4 13 8-13 8V4Z" fill="#2a331e" />
          <Path d="m2 8 6 4-6 4V8Z" fill="#2a331e" />
        </Svg>
      </View>
      <Txt size={small ? 18 : 21} weight="600" style={{ letterSpacing: -0.8 }}>
        tubepilot
        <Txt size={9} weight="600" color={theme.purple}>
          {" "}
          AI
        </Txt>
      </Txt>
    </Row>
  );
}

export function Youtube({
  size = 24,
  color = "#ed9499",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect
        x="2"
        y="5"
        width="20"
        height="14"
        rx="4"
        fill="none"
        stroke={color}
        strokeWidth="1.7"
      />
      <Path d="m10 8 6 4-6 4V8Z" fill={color} />
    </Svg>
  );
}
