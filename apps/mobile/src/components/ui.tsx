import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  type TextProps,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import {
  Check,
  ChevronDown,
  X,
  Sparkles,
  ArrowRight,
} from "lucide-react-native";
import { useApp } from "../state";

export function Txt({
  children,
  size = 14,
  weight = "400",
  muted = false,
  color,
  style,
  ...props
}: TextProps & {
  size?: number;
  weight?: TextStyle["fontWeight"];
  muted?: boolean;
  color?: string;
}) {
  const { theme } = useApp();
  return (
    <Text
      {...props}
      style={[
        {
          fontFamily:
            Platform.OS === "web"
              ? 'Inter, "Noto Sans Bengali", sans-serif'
              : undefined,
          fontSize: size,
          lineHeight: Math.round(size * 1.5),
          fontWeight: weight,
          color: color ?? (muted ? theme.muted : theme.text),
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Heading({
  children,
  size = 28,
  style,
  ...props
}: React.ComponentProps<typeof Txt>) {
  return (
    <Txt
      accessibilityRole="header"
      {...props}
      size={size}
      weight="600"
      style={[
        {
          fontFamily:
            Platform.OS === "web"
              ? 'Manrope, "Noto Sans Bengali", sans-serif'
              : undefined,
          letterSpacing: -0.8,
          lineHeight: Math.round(size * 1.3),
        },
        style,
      ]}
    >
      {children}
    </Txt>
  );
}
export function Row({
  style,
  gap = 10,
  ...props
}: ViewProps & { gap?: number }) {
  return (
    <View
      {...props}
      style={[{ flexDirection: "row", alignItems: "center", gap }, style]}
    />
  );
}
export function Card({ style, ...props }: ViewProps) {
  const { theme } = useApp();
  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: theme.card,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 15,
          padding: 22,
        },
        style,
      ]}
    />
  );
}
export function Badge({
  children,
  color,
  dot = false,
}: {
  children: React.ReactNode;
  color?: string;
  dot?: boolean;
}) {
  const { theme } = useApp();
  const c = color ?? theme.purple;
  return (
    <Row
      gap={5}
      style={{
        alignSelf: "flex-start",
        backgroundColor: c + "15",
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
      }}
    >
      {dot && (
        <View
          style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c }}
        />
      )}
      <Txt color={c} size={10} weight="600">
        {children}
      </Txt>
    </Row>
  );
}
export function Button({
  children,
  onPress,
  icon: Icon,
  variant = "primary",
  small = false,
  disabled = false,
  loading = false,
  style,
  label,
}: {
  children?: React.ReactNode;
  onPress?: () => void;
  icon?: React.ComponentType<any>;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  small?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  label?: string;
}) {
  const { theme } = useApp();
  const [hover, setHover] = useState(false);
  const c =
    variant === "primary"
      ? theme.accentText
      : variant === "danger"
        ? theme.danger
        : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        label ?? (typeof children === "string" ? children : undefined)
      }
      disabled={disabled || loading}
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          minHeight: small ? 34 : 42,
          paddingHorizontal: children ? (small ? 12 : 16) : 10,
          borderRadius: 8,
          borderWidth: variant === "secondary" ? 1 : 0,
          borderColor: theme.border,
          backgroundColor:
            variant === "primary"
              ? theme.accent
              : variant === "secondary"
                ? hover
                  ? theme.cardAlt
                  : theme.card
                : hover
                  ? theme.cardAlt
                  : "transparent",
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={c} />
      ) : Icon ? (
        <Icon size={small ? 14 : 16} color={c} strokeWidth={1.8} />
      ) : null}
      {!!children && (
        <Txt size={small ? 11 : 12} color={c} weight="600">
          {children}
        </Txt>
      )}
    </Pressable>
  );
}
export function Chip({
  children,
  active,
  onPress,
  icon: Icon,
}: {
  children: React.ReactNode;
  active?: boolean;
  onPress?: () => void;
  icon?: React.ComponentType<any>;
}) {
  const { theme } = useApp();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingVertical: 9,
        paddingHorizontal: 13,
        borderRadius: 8,
        backgroundColor: active ? theme.purpleBg : theme.card,
        borderWidth: 1,
        borderColor: active ? theme.purple + "77" : theme.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {Icon && <Icon size={13} color={active ? theme.purple : theme.muted} />}
      <Txt
        size={11}
        weight={active ? "600" : "400"}
        color={active ? theme.purple : theme.muted}
      >
        {children}
      </Txt>
    </Pressable>
  );
}
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  secure = false,
  disabled = false,
  style,
  autoFocus = false,
}: {
  label?: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  multiline?: boolean;
  secure?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  autoFocus?: boolean;
}) {
  const { theme } = useApp();
  return (
    <View style={[{ gap: 8 }, style]}>
      {!!label && (
        <Txt size={12} weight="500">
          {label}
        </Txt>
      )}
      <TextInput
        accessibilityLabel={label ?? placeholder}
        autoFocus={autoFocus}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.faint}
        multiline={multiline}
        secureTextEntry={secure}
        editable={!disabled}
        autoCapitalize={
          secure || label?.toLowerCase().includes("email")
            ? "none"
            : "sentences"
        }
        textAlignVertical={multiline ? "top" : "center"}
        style={{
          fontFamily:
            Platform.OS === "web"
              ? 'Inter, "Noto Sans Bengali", sans-serif'
              : undefined,
          color: theme.text,
          backgroundColor: theme.input,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 9,
          padding: 13,
          fontSize: 13,
          lineHeight: 21,
          minHeight: multiline ? 128 : 44,
        }}
      />
    </View>
  );
}
export function Select({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: string;
  options: (string | { label: string; value: string })[];
  onChange: (v: string) => void;
}) {
  const { theme } = useApp();
  const [open, setOpen] = useState(false);
  const items = options.map((o) =>
    typeof o === "string" ? { label: o, value: o } : o,
  );
  return (
    <View style={{ gap: 8 }}>
      {!!label && (
        <Txt size={12} weight="500">
          {label}
        </Txt>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          label ?? items.find((o) => o.value === value)?.label ?? value
        }
        onPress={() => setOpen(true)}
        style={{
          minHeight: 42,
          paddingHorizontal: 12,
          backgroundColor: theme.input,
          borderColor: theme.border,
          borderWidth: 1,
          borderRadius: 8,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Txt size={12}>
          {items.find((o) => o.value === value)?.label ?? value}
        </Txt>
        <ChevronDown size={14} color={theme.muted} />
      </Pressable>
      <ModalShell
        visible={open}
        title={label ?? "Choose an option"}
        onClose={() => setOpen(false)}
        width={380}
      >
        {items.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            onPress={() => {
              onChange(option.value);
              setOpen(false);
            }}
            style={{
              padding: 14,
              borderRadius: 8,
              backgroundColor:
                value === option.value ? theme.cardAlt : undefined,
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <Txt>{option.label}</Txt>
            {value === option.value && <Check size={16} color={theme.accent} />}
          </Pressable>
        ))}
      </ModalShell>
    </View>
  );
}
export function ModalShell({
  visible,
  title,
  subtitle,
  onClose,
  children,
  width = 620,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  const { theme } = useApp();
  const size = useWindowDimensions();
  useEffect(() => {
    if (!visible || Platform.OS !== "web") return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [visible, onClose]);
  // Do not leave a closing web dialog's controls in the accessibility tree.
  // This also avoids pointer/focus races when one dialog opens another.
  if (!visible && Platform.OS === "web") return null;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 18,
          backgroundColor: theme.overlay,
        }}
      >
        <Pressable
          accessibilityLabel="Close dialog backdrop"
          style={{ position: "absolute", top: 0, right: 0, left: 0, bottom: 0 }}
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          style={{
            width: Math.min(width, size.width - 32),
            maxHeight: size.height - 70,
            backgroundColor: theme.card,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: theme.border,
            overflow: "hidden",
          }}
        >
          <Row
            style={{
              padding: 24,
              borderBottomWidth: 1,
              borderBottomColor: theme.border,
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1 }}>
              <Heading size={21}>{title}</Heading>
              {!!subtitle && (
                <Txt size={12} muted style={{ marginTop: 5 }}>
                  {subtitle}
                </Txt>
              )}
            </View>
            <Button
              icon={X}
              variant="ghost"
              label="Close dialog"
              onPress={onClose}
            />
          </Row>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 24, gap: 18 }}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
export function Progress({
  value,
  color,
  height = 5,
}: {
  value: number;
  color?: string;
  height?: number;
}) {
  const { theme } = useApp();
  return (
    <View
      style={{
        height,
        backgroundColor: theme.border,
        borderRadius: 20,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          height,
          width: `${Math.max(0, Math.min(100, value))}%`,
          backgroundColor: color ?? theme.purple,
          borderRadius: 20,
        }}
      />
    </View>
  );
}
export function Empty({
  title,
  description,
  action,
  onAction,
  icon: Icon = Sparkles,
}: {
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
  icon?: React.ComponentType<any>;
}) {
  const { theme } = useApp();
  return (
    <View style={{ padding: 40, alignItems: "center", gap: 15 }}>
      <View
        style={{
          width: 58,
          height: 58,
          borderRadius: 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.purpleBg,
        }}
      >
        <Icon size={27} color={theme.purple} />
      </View>
      <Heading size={22} style={{ textAlign: "center" }}>
        {title}
      </Heading>
      <Txt muted size={13} style={{ textAlign: "center", maxWidth: 380 }}>
        {description}
      </Txt>
      {action && (
        <Button onPress={onAction} icon={ArrowRight}>
          {action}
        </Button>
      )}
    </View>
  );
}
export function SectionHeading({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <Row style={{ justifyContent: "space-between", marginBottom: 16 }}>
      <View style={{ flex: 1, gap: 3 }}>
        <Heading size={18}>{title}</Heading>
        {!!subtitle && (
          <Txt size={11} muted>
            {subtitle}
          </Txt>
        )}
      </View>
      {action && (
        <Button small variant="ghost" icon={ArrowRight} onPress={onAction}>
          {action}
        </Button>
      )}
    </Row>
  );
}
export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const { theme } = useApp();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.34,
        backgroundColor: theme.purpleBg,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Txt color={theme.purple} size={size * 0.39} weight="600">
        {name
          .trim()
          .split(" ")
          .map((x) => x[0])
          .slice(0, 2)
          .join("")}
      </Txt>
    </View>
  );
}
export function Markdown({ text }: { text: string }) {
  return (
    <View style={{ gap: 8 }}>
      {text.split("\n").map((line, index) =>
        line.startsWith("#") ? (
          <Heading
            key={index}
            size={line.startsWith("##") ? 16 : 18}
            style={{ marginTop: index ? 18 : 0 }}
          >
            {line.replace(/^#+\s*/, "")}
          </Heading>
        ) : (
          <Txt key={index} selectable size={13} style={{ lineHeight: 23 }}>
            {line.replace(/\*\*/g, "") || " "}
          </Txt>
        ),
      )}
    </View>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Row
      style={{
        justifyContent: "space-between",
        marginBottom: 25,
        alignItems: "flex-start",
        flexWrap: "wrap",
      }}
    >
      <View style={{ gap: 7, flex: 1, minWidth: 230 }}>
        {eyebrow && (
          <Txt muted size={10} weight="600" style={{ letterSpacing: 1.4 }}>
            {eyebrow}
          </Txt>
        )}
        <Heading size={28}>{title}</Heading>
        <Txt size={12} muted>
          {description}
        </Txt>
      </View>
      {action}
    </Row>
  );
}
