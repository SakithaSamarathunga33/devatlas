import { HStack } from "@astryxdesign/core/HStack";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";

import { useAppInfo } from "@/hooks/use-app-info";

const STATUS = {
  pending: { label: "Connecting to backend", variant: "warning" },
  success: { label: "Backend connected", variant: "success" },
  error: { label: "Backend unavailable", variant: "error" },
} as const;

/** Live indicator of the Rust backend connection, derived from the app-info query. */
export function BackendStatus() {
  const { status } = useAppInfo();
  const { label, variant } = STATUS[status];

  return (
    <span role="status">
      <HStack gap={2} vAlign="center">
        <StatusDot variant={variant} label={label} isPulsing={status === "pending"} />
        <Text type="supporting">{label}</Text>
      </HStack>
    </span>
  );
}
