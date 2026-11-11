import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { Minus, X } from "lucide-react";

import { Mark } from "@/components/ui";

interface TitleBarProps {
  onMinimize: () => void;
  onClose: () => void;
  canClose: boolean;
}

/** Frameless window title bar; the label area drags the window. */
export function TitleBar({ onMinimize, onClose, canClose }: TitleBarProps) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 pr-1 pl-4" data-tauri-drag-region>
      <Mark className="pointer-events-none size-4" />
      <span className="pointer-events-none">
        <Text type="supporting">DevAtlas Setup</Text>
      </span>
      <div className="ml-auto flex gap-0.5">
        <Button
          label="Minimize"
          variant="ghost"
          size="sm"
          isIconOnly
          icon={<Icon icon={Minus} />}
          onClick={onMinimize}
        />
        <Button
          label="Close"
          variant="ghost"
          size="sm"
          isIconOnly
          icon={<Icon icon={X} />}
          isDisabled={!canClose}
          tooltip={canClose ? undefined : "Setup can close once installation finishes"}
          onClick={onClose}
        />
      </div>
    </div>
  );
}
