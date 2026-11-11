import { Icon } from "@astryxdesign/core/Icon";
import { ToggleButton } from "@astryxdesign/core/ToggleButton";
import { Sparkles } from "lucide-react";

/** Filters a feed down to what matches the user's tags and library. */
export function ForYouToggle({
  active,
  disabled,
  onToggle,
}: {
  active: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <ToggleButton
      label="For you"
      isPressed={active}
      isDisabled={disabled}
      icon={<Icon icon={Sparkles} />}
      tooltip={
        disabled ? "Add tags to your links first" : "Show what matches your tags and library"
      }
      onPressedChange={onToggle}
    >
      For you
    </ToggleButton>
  );
}
