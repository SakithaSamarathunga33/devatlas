import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { format } from "date-fns";
import { Plus, Search } from "lucide-react";

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** The dashboard's greeting: the date, a large hello, and the library's news in one line.
 * `summary` is null when there is nothing to say about the library. */
export function WelcomeHero({ summary }: { summary: string | null }) {
  const now = new Date();

  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
      <VStack gap={2} className="min-w-0">
        <Text type="label" color="accent">
          {format(now, "EEEE, MMMM d")}
        </Text>
        <Heading level={1} type="display-1">
          {greeting(now.getHours())}
        </Heading>
        {summary !== null && (
          <Text as="p" type="large" color="secondary">
            {summary}
          </Text>
        )}
      </VStack>
      <HStack gap={2} wrap="wrap">
        <Button
          variant="primary"
          size="lg"
          label="Add a link"
          href="/library?add=1"
          icon={<Icon icon={Plus} />}
        />
        <Button size="lg" label="Search library" href="/library" icon={<Icon icon={Search} />} />
      </HStack>
    </div>
  );
}
