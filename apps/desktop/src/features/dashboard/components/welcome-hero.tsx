import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { format } from "date-fns";
import { Plus, Search } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** The dashboard's title row. `summary` is null until the library has loaded. */
export function WelcomeHero({ summary }: { summary: string | null }) {
  const now = new Date();
  const date = format(now, "EEE, MMM d");

  return (
    <PageHeader
      title={greeting(now.getHours())}
      description={summary === null ? date : `${date} · ${summary}`}
    >
      <HStack gap={2} wrap="wrap">
        <Button
          variant="primary"
          label="Add a link"
          href="/library?add=1"
          icon={<Icon icon={Plus} />}
        />
        <Button label="Search library" href="/library" icon={<Icon icon={Search} />} />
      </HStack>
    </PageHeader>
  );
}
