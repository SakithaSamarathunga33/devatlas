import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Center } from "@astryxdesign/core/Center";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { InputGroup } from "@astryxdesign/core/InputGroup";
import { ScrollableArea } from "@astryxdesign/core/ScrollableArea";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { ArrowLeft, ArrowRight } from "lucide-react";

import license from "../../../../LICENSE?raw";
import { Mark, StepScreen } from "@/components/ui";
import { formatBytes } from "@/lib/format";

interface WelcomeProps {
  isReady: boolean;
  error: string | null;
  /** Shown under the actions, once known. */
  details: string | null;
  onInstall: () => void;
  onCustomize: () => void;
}

export function WelcomeScreen({ isReady, error, details, onInstall, onCustomize }: WelcomeProps) {
  return (
    <Center height="100%" padding={6}>
      <VStack gap={6} hAlign="center" maxWidth={360}>
        <VStack gap={3} hAlign="center">
          <Mark className="size-20" />
          <Heading level={1} type="display-3" justify="center" className="outline-none">
            DevAtlas
          </Heading>
          <Text type="large" color="secondary" justify="center" as="p">
            Your developer resources, organized and searchable on this computer.
          </Text>
        </VStack>
        {error && <Banner role="alert" status="error" title={error} />}
        <VStack gap={2} hAlign="center" width="100%">
          <Button
            label="Install DevAtlas"
            variant="primary"
            size="lg"
            width="100%"
            isDisabled={!isReady}
            onClick={onInstall}
          />
          <Button
            label="Customize Installation"
            variant="ghost"
            isDisabled={!isReady}
            onClick={onCustomize}
          />
        </VStack>
        {details !== null && (
          <Text type="supporting" justify="center">
            {details}
          </Text>
        )}
      </VStack>
    </Center>
  );
}

const [LICENSE_TITLE = "", ...LICENSE_BODY] = license.trim().split("\n");
// LICENSE is hard-wrapped at 80 columns; reflow each paragraph to the box width.
const LICENSE_PARAGRAPHS = LICENSE_BODY.join("\n")
  .trim()
  .split(/\n\s*\n/)
  .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " "));

interface LicenseProps {
  isAccepted: boolean;
  onAcceptedChange: (isAccepted: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}

export function LicenseScreen({ isAccepted, onAcceptedChange, onBack, onNext }: LicenseProps) {
  return (
    <StepScreen
      title="License Agreement"
      description="Please review the license terms before installing DevAtlas."
      footer={
        <>
          <Button label="Back" onClick={onBack} />
          <Button
            label="Next"
            variant="primary"
            endContent={<Icon icon={ArrowRight} />}
            isDisabled={!isAccepted}
            onClick={onNext}
          />
        </>
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="min-h-0 flex-1 overflow-hidden rounded-[var(--radius-container)] border border-[var(--color-border)] select-text">
          <ScrollableArea label="License terms" role="region" height="100%" padding={4}>
            <VStack gap={3}>
              <Heading level={2}>{LICENSE_TITLE}</Heading>
              {LICENSE_PARAGRAPHS.map((paragraph) => (
                <Text key={paragraph} type="supporting" as="p">
                  {paragraph}
                </Text>
              ))}
            </VStack>
          </ScrollableArea>
        </div>
        <CheckboxInput
          label="I agree to the terms of the License Agreement"
          value={isAccepted}
          onChange={onAcceptedChange}
        />
      </div>
    </StepScreen>
  );
}

export interface ChosenOptions {
  dir: string;
  desktopShortcut: boolean;
  startMenuShortcut: boolean;
  launchAfterInstall: boolean;
}

interface OptionsProps {
  options: ChosenOptions;
  requiredBytes: number;
  availableBytes: number | null;
  error: string | null;
  onChange: (options: ChosenOptions) => void;
  onBrowse: () => void;
  onBack: () => void;
  onNext: () => void;
}

export function OptionsScreen(props: OptionsProps) {
  const { options, requiredBytes, availableBytes, error, onChange, onBrowse, onBack, onNext } =
    props;
  const isTooSmall = availableBytes !== null && availableBytes < requiredBytes;
  const isEmpty = options.dir.trim().length === 0;
  const problem =
    error ??
    (isEmpty
      ? "Choose a folder to install DevAtlas in."
      : isTooSmall
        ? `Not enough space on this drive. DevAtlas needs ~${formatBytes(requiredBytes)}.`
        : null);
  const set = (patch: Partial<ChosenOptions>) => {
    onChange({ ...options, ...patch });
  };

  return (
    <StepScreen
      title="Installation Options"
      description="Choose where DevAtlas goes and how you open it."
      footer={
        <>
          <Button label="Back" icon={<Icon icon={ArrowLeft} />} onClick={onBack} />
          <Button
            label="Next"
            variant="primary"
            endContent={<Icon icon={ArrowRight} />}
            isDisabled={isEmpty || isTooSmall}
            onClick={onNext}
          />
        </>
      }
    >
      <VStack gap={5}>
        <VStack gap={1.5}>
          <InputGroup
            label="Installation Location"
            status={problem === null ? undefined : { type: "error" }}
          >
            <TextInput
              label="Installation Location"
              isLabelHidden
              value={options.dir}
              onChange={(dir) => {
                set({ dir });
              }}
            />
            <Button label="Browse…" onClick={onBrowse} />
          </InputGroup>
          <Text type="supporting">
            Needs ~{formatBytes(requiredBytes)} · Available Space:{" "}
            {availableBytes === null ? "unknown" : formatBytes(availableBytes)}
          </Text>
        </VStack>
        <VStack gap={3}>
          <CheckboxInput
            label="Create a desktop shortcut"
            value={options.desktopShortcut}
            onChange={(desktopShortcut) => {
              set({ desktopShortcut });
            }}
          />
          <CheckboxInput
            label="Add to Start Menu"
            value={options.startMenuShortcut}
            onChange={(startMenuShortcut) => {
              set({ startMenuShortcut });
            }}
          />
          <CheckboxInput
            label="Launch DevAtlas after installation"
            value={options.launchAfterInstall}
            onChange={(launchAfterInstall) => {
              set({ launchAfterInstall });
            }}
          />
        </VStack>
        {problem !== null && <Banner role="alert" status="error" title={problem} />}
      </VStack>
    </StepScreen>
  );
}
