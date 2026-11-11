import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { Section } from "@astryxdesign/core/Section";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { ReactNode } from "react";

interface SettingsSectionProps {
  title: string;
  description: string;
  children: ReactNode;
}

/** One settings group: what it is on the left, its controls on the right. */
export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <Section variant="transparent" padding={0} maxWidth={960}>
      <Grid gap={10} columns={{ minWidth: 320, max: 2 }}>
        <VStack gap={1}>
          <Heading level={2}>{title}</Heading>
          <Text type="supporting" as="p">
            {description}
          </Text>
        </VStack>
        {children}
      </Grid>
    </Section>
  );
}
