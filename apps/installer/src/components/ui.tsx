import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Layout, LayoutContent, LayoutFooter, LayoutHeader } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { ReactNode } from "react";

interface StepScreenProps {
  title: string;
  description: string;
  /** The navigation buttons, aligned to the end of the footer. */
  footer?: ReactNode;
  children: ReactNode;
}

/** The frame of every step: heading on top, content filling the middle, buttons below. */
export function StepScreen({ title, description, footer, children }: StepScreenProps) {
  return (
    <Layout
      height="fill"
      padding={6}
      header={
        <LayoutHeader>
          <VStack gap={1}>
            <Heading level={1} className="outline-none">
              {title}
            </Heading>
            <Text type="supporting">{description}</Text>
          </VStack>
        </LayoutHeader>
      }
      footer={
        footer !== undefined && (
          <LayoutFooter>
            <HStack gap={2} hAlign="end">
              {footer}
            </HStack>
          </LayoutFooter>
        )
      }
    >
      <LayoutContent isScrollable={false}>{children}</LayoutContent>
    </Layout>
  );
}

export function Mark({ className = "" }: { className?: string }) {
  return <img src="/devatlas-mark.png" alt="" draggable={false} className={className} />;
}
