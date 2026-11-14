import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Center } from "@astryxdesign/core/Center";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { Check, Circle, CircleCheck } from "lucide-react";

import { StepScreen } from "@/components/ui";
import { INSTALL_STEPS, type InstallProgress } from "@/services/installer";

const STEP_LABELS: Record<(typeof INSTALL_STEPS)[number], string> = {
  preparing: "Preparing files…",
  extracting: "Extracting resources…",
  configuring: "Configuring application…",
  finalizing: "Finalizing installation…",
};

interface InstallingProps {
  progress: InstallProgress | null;
  error: string | null;
  onRetry: () => void;
  onBack: () => void;
}

export function InstallingScreen({ progress, error, onRetry, onBack }: InstallingProps) {
  const percent = progress?.percent ?? 0;
  const current = INSTALL_STEPS.indexOf(progress?.step ?? "preparing");
  const isDone = percent === 100;

  return (
    <StepScreen
      title="Installing DevAtlas"
      description="This usually takes less than a minute."
      footer={
        error ? (
          <>
            <Button label="Back" onClick={onBack} />
            <Button label="Try again" variant="primary" onClick={onRetry} />
          </>
        ) : undefined
      }
    >
      <VStack gap={5}>
        <VStack gap={2}>
          <ProgressBar
            label="Installation progress"
            isLabelHidden
            value={percent}
            variant={error ? "error" : "accent"}
          />
          <Text type="supporting" hasTabularNumbers>
            {error ? "Installation stopped" : `Installing… ${String(percent)}%`}
          </Text>
        </VStack>

        {/* Announce step changes and failures, not every percent. */}
        <p className="sr-only" aria-live="polite">
          {error ? "Installation stopped" : STEP_LABELS[INSTALL_STEPS[current] ?? "preparing"]}
        </p>

        {error ? (
          <Banner role="alert" status="error" title={error} />
        ) : (
          <VStack as="ol" gap={2}>
            {INSTALL_STEPS.map((step, index) => {
              const state =
                index < current || isDone ? "done" : index === current ? "active" : "pending";
              return (
                <HStack as="li" key={step} gap={2} vAlign="center">
                  {state === "done" && <Icon icon={Check} size="sm" color="accent" />}
                  {state === "active" && <Spinner size="sm" />}
                  {state === "pending" && <Icon icon={Circle} size="sm" color="disabled" />}
                  <Text color={state === "pending" ? "disabled" : "primary"}>
                    {STEP_LABELS[step]}
                  </Text>
                </HStack>
              );
            })}
          </VStack>
        )}
      </VStack>
    </StepScreen>
  );
}

interface CompleteProps {
  isLaunching: boolean;
  error: string | null;
  onLaunch: () => void;
  onFinish: () => void;
}

export function CompleteScreen({ isLaunching, error, onLaunch, onFinish }: CompleteProps) {
  return (
    <Center height="100%" padding={6}>
      <VStack gap={6} hAlign="center" maxWidth={360}>
        <VStack gap={3} hAlign="center">
          <Icon icon={CircleCheck} color="success" size="lg" className="size-14" />
          <Heading level={1} justify="center" className="outline-none">
            Installation Complete!
          </Heading>
          <Text color="secondary" justify="center" as="p">
            DevAtlas is installed and ready to open.
          </Text>
        </VStack>
        {error && <Banner role="alert" status="error" title={error} />}
        <VStack gap={2} width="100%">
          <Button
            label="Launch DevAtlas"
            variant="primary"
            size="lg"
            width="100%"
            isLoading={isLaunching}
            onClick={onLaunch}
          />
          <Button label="Finish" variant="ghost" width="100%" onClick={onFinish} />
        </VStack>
      </VStack>
    </Center>
  );
}
